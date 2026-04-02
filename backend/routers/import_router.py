"""PDF 임포트 API 라우터."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, delete
from sse_starlette.sse import EventSourceResponse

from database import get_session, engine
from models import Question
from services.pdf_parser import parse_exam_folder, get_available_years
from services.llm import tag_units_batch, tag_units_stream

# 보안: data/exams/ 경로만 허용 (path traversal 방지)
BASE_DIR = Path(__file__).parent.parent.parent
EXAMS_DIR = BASE_DIR / "data" / "exams"

router = APIRouter(prefix="/api/import", tags=["임포트"])


# ---------------------------------------------------------------------------
# 요청/응답 모델
# ---------------------------------------------------------------------------

class ImportRequest(BaseModel):
    year: str
    action: Optional[str] = None  # "overwrite" | "skip" | None


class ImportStatusResponse(BaseModel):
    year: str
    imported: bool
    question_count: int


class ImportResult(BaseModel):
    success: int
    failed: int
    failed_items: List[Dict]


# ---------------------------------------------------------------------------
# 엔드포인트
# ---------------------------------------------------------------------------

@router.get("/years")
def get_years() -> List[Dict]:
    """data/exams/ 아래 연도 폴더 목록 반환."""
    years = get_available_years()
    return [{"year": y} for y in years]


@router.get("/status/{year}", response_model=ImportStatusResponse)
def get_import_status(year: str, session: Session = Depends(get_session)):
    """해당 연도 임포트 여부 및 문제 수 반환."""
    # 경로 탐색 공격 방지: 숫자만 허용
    if not year.isdigit():
        raise HTTPException(status_code=400, detail="연도는 숫자만 입력 가능합니다.")

    stmt = select(Question).where(Question.year == int(year))
    existing = session.exec(stmt).all()
    return ImportStatusResponse(
        year=year,
        imported=len(existing) > 0,
        question_count=len(existing),
    )


@router.post("/run", response_model=ImportResult)
async def run_import(req: ImportRequest, session: Session = Depends(get_session)):
    """
    해당 연도 PDF 임포트 실행.
    파싱 → DB 저장 → LLM 단원 태깅 순서로 실행.
    """
    year_str = req.year
    if not year_str.isdigit():
        raise HTTPException(status_code=400, detail="연도는 숫자만 입력 가능합니다.")

    year = int(year_str)

    # 경로 탐색 방지: data/exams/{year} 하위만 허용
    year_dir = EXAMS_DIR / year_str
    try:
        year_dir.resolve().relative_to(EXAMS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="허용되지 않은 경로입니다.")

    # 중복 임포트 처리
    stmt = select(Question).where(Question.year == year)
    existing = session.exec(stmt).all()

    if existing:
        if req.action == "skip":
            return ImportResult(
                success=0,
                failed=0,
                failed_items=[{"reason": f"{year}년 데이터가 이미 존재하여 건너뜁니다.", "page": None, "text": ""}],
            )
        elif req.action == "overwrite":
            # 기존 데이터 삭제
            session.exec(delete(Question).where(Question.year == year))  # type: ignore[arg-type]
            session.commit()
        else:
            # action 미지정 + 기존 데이터 존재 → 클라이언트에 선택 요청
            raise HTTPException(
                status_code=409,
                detail=f"{year}년 데이터가 이미 존재합니다. action=overwrite 또는 action=skip을 지정하세요.",
            )

    # 연도 폴더 존재 확인
    if not year_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=f"data/exams/{year_str}/ 폴더를 찾을 수 없습니다. PDF 파일을 해당 폴더에 넣어주세요.",
        )

    # 1단계: PDF 파싱
    try:
        result = parse_exam_folder(year)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF 파싱 실패: {e}")

    parsed_questions = result["questions"]
    failed_items = result["failed"]

    if not parsed_questions:
        return ImportResult(
            success=0,
            failed=len(failed_items),
            failed_items=failed_items,
        )

    # 2단계: DB 저장
    db_questions = []
    for q in parsed_questions:
        db_q = Question(
            year=q["year"],
            exam_type=q["exam_type"],
            session=q.get("session"),
            subject=q["subject"],
            question_type=q["question_type"],
            question_number=q["question_number"],
            question_text=q["question_text"],
            options=q.get("options"),
            answer=q.get("answer"),
            unit="미분류",
        )
        session.add(db_q)
    session.commit()

    # 저장된 문제 ID 조회 (LLM 태깅용)
    stmt2 = select(Question).where(Question.year == year)
    saved_questions = session.exec(stmt2).all()

    # 3단계: LLM 단원 태깅
    tag_inputs = [
        {"subject": q.subject, "question_text": q.question_text}
        for q in saved_questions
    ]
    units = await tag_units_batch(tag_inputs)

    for q, unit in zip(saved_questions, units):
        q.unit = unit
        session.add(q)
    session.commit()

    return ImportResult(
        success=len(saved_questions),
        failed=len(failed_items),
        failed_items=failed_items,
    )


@router.get("/run-stream")
async def run_import_stream(year: str, action: Optional[str] = None):
    """SSE로 임포트 진행 상태를 실시간 스트리밍."""

    async def event_generator():
        from sqlmodel import Session as SQLSession

        def send(stage: str, **kwargs):
            return {"event": "progress", "data": json.dumps({"stage": stage, **kwargs})}

        with SQLSession(engine) as session:
            try:
                # 입력 검증
                if not year.isdigit():
                    yield send("error", message="연도는 숫자만 입력 가능합니다.")
                    return

                year_int = int(year)
                year_dir = EXAMS_DIR / year
                try:
                    year_dir.resolve().relative_to(EXAMS_DIR.resolve())
                except ValueError:
                    yield send("error", message="허용되지 않은 경로입니다.")
                    return

                # 중복 처리
                existing = session.exec(select(Question).where(Question.year == year_int)).all()
                if existing:
                    if action == "skip":
                        yield send("done", success=0, failed=0, failed_items=[])
                        return
                    elif action == "overwrite":
                        session.exec(delete(Question).where(Question.year == year_int))  # type: ignore[arg-type]
                        session.commit()
                    else:
                        yield send("error", message="duplicate", question_count=len(existing))
                        return

                if not year_dir.exists():
                    yield send("error", message=f"data/exams/{year}/ 폴더를 찾을 수 없습니다.")
                    return

                # 1단계: PDF 파싱 (별도 스레드에서 실행 — 이벤트 루프 블로킹 방지)
                yield send("parsing", message="PDF 파싱 중...")
                await asyncio.sleep(0.1)  # 이벤트 플러시 보장
                try:
                    result = await asyncio.to_thread(parse_exam_folder, year_int)
                except Exception as e:
                    yield send("error", message=f"PDF 파싱 실패: {e}")
                    return

                parsed_questions = result["questions"]
                failed_items = result["failed"]

                if not parsed_questions:
                    yield send("done", success=0, failed=len(failed_items), failed_items=failed_items)
                    return

                # 2단계: DB 저장
                yield send("saving", message="DB에 저장 중...", total=len(parsed_questions))
                await asyncio.sleep(0.1)  # 이벤트 플러시 보장
                for q in parsed_questions:
                    db_q = Question(
                        year=q["year"],
                        exam_type=q["exam_type"],
                        session=q.get("session"),
                        subject=q["subject"],
                        question_type=q["question_type"],
                        question_number=q["question_number"],
                        question_text=q["question_text"],
                        options=q.get("options"),
                        answer=q.get("answer"),
                        unit="미분류",
                    )
                    session.add(db_q)
                session.commit()

                saved_questions = session.exec(
                    select(Question).where(Question.year == year_int)
                ).all()
                total = len(saved_questions)

                # 3단계: LLM 단원 태깅 (문제별 스트리밍)
                tag_inputs = [
                    {"subject": q.subject, "question_text": q.question_text}
                    for q in saved_questions
                ]
                async for idx, unit in tag_units_stream(tag_inputs):
                    saved_questions[idx].unit = unit
                    session.add(saved_questions[idx])
                    yield send(
                        "tagging",
                        current=idx + 1,
                        total=total,
                        unit=unit,
                        subject=saved_questions[idx].subject,
                    )

                session.commit()

                yield send("done", success=total, failed=len(failed_items), failed_items=failed_items)

            except Exception as e:
                yield send("error", message=f"임포트 중 오류가 발생했습니다: {e}")

    return EventSourceResponse(event_generator())
