"""오답노트 API 라우터."""
from __future__ import annotations

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import Bookmark, Question, WrongAnswer

router = APIRouter(prefix="/api/wrong-answers", tags=["오답노트"])


# ---------------------------------------------------------------------------
# 응답 모델
# ---------------------------------------------------------------------------

class WrongAnswerItem(BaseModel):
    """오답노트 목록 아이템."""
    id: int
    question_id: int
    wrong_count: int
    last_wrong_at: str
    has_explanation: bool
    # 문제 정보
    year: int
    exam_type: str
    session: Optional[str]
    subject: str
    unit: Optional[str]
    question_number: int
    question_text: str
    question_type: str
    has_bookmark: bool
    bookmark_tag: Optional[str]


class WrongAnswerDetail(WrongAnswerItem):
    """오답 상세 (보기 + 정답 포함)."""
    options: Optional[List[str]]
    answer: Optional[str]
    explanation: Optional[str]


class WrongAnswerListResponse(BaseModel):
    items: List[WrongAnswerItem]
    total: int


class ExplanationResponse(BaseModel):
    explanation: str


# ---------------------------------------------------------------------------
# 엔드포인트
# ---------------------------------------------------------------------------

@router.get("", response_model=WrongAnswerListResponse)
def list_wrong_answers(
    sort: str = "recent",   # "recent" | "count" | "subject"
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_session),
):
    """오답 목록 조회."""
    if page < 1:
        raise HTTPException(status_code=400, detail="page는 1 이상이어야 합니다.")

    wrongs = db.exec(select(WrongAnswer)).all()

    # 정렬
    if sort == "recent":
        wrongs = sorted(wrongs, key=lambda w: w.last_wrong_at, reverse=True)
    elif sort == "count":
        wrongs = sorted(wrongs, key=lambda w: w.wrong_count, reverse=True)
    # subject 정렬은 문제 정보 조인 후 처리

    total = len(wrongs)
    offset = (page - 1) * page_size
    paged = wrongs[offset: offset + page_size]

    all_bookmarks = {b.question_id: b.tag for b in db.exec(select(Bookmark)).all()}

    items = []
    for w in paged:
        q = db.get(Question, w.question_id)
        if not q:
            continue
        items.append(
            WrongAnswerItem(
                id=w.id,
                question_id=w.question_id,
                wrong_count=w.wrong_count,
                last_wrong_at=w.last_wrong_at.isoformat(),
                has_explanation=bool(w.explanation),
                year=q.year,
                exam_type=q.exam_type,
                session=q.session,
                subject=q.subject,
                unit=q.unit,
                question_number=q.question_number,
                question_text=q.question_text,
                question_type=q.question_type,
                has_bookmark=w.question_id in all_bookmarks,
                bookmark_tag=all_bookmarks.get(w.question_id),
            )
        )

    # 과목별 정렬은 items 완성 후 처리
    if sort == "subject":
        items = sorted(items, key=lambda i: (i.subject, i.unit or "", i.question_number))

    return WrongAnswerListResponse(items=items, total=total)


@router.get("/{question_id}", response_model=WrongAnswerDetail)
def get_wrong_answer(question_id: int, db: Session = Depends(get_session)):
    """오답 상세 조회."""
    wrong = db.exec(
        select(WrongAnswer).where(WrongAnswer.question_id == question_id)
    ).first()
    if not wrong:
        raise HTTPException(status_code=404, detail="오답 이력이 없습니다.")

    q = db.get(Question, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

    bookmark = db.exec(
        select(Bookmark).where(Bookmark.question_id == question_id)
    ).first()

    options_list = None
    if q.options:
        try:
            options_list = json.loads(q.options)
        except (json.JSONDecodeError, TypeError):
            options_list = None

    return WrongAnswerDetail(
        id=wrong.id,
        question_id=wrong.question_id,
        wrong_count=wrong.wrong_count,
        last_wrong_at=wrong.last_wrong_at.isoformat(),
        has_explanation=bool(wrong.explanation),
        year=q.year,
        exam_type=q.exam_type,
        session=q.session,
        subject=q.subject,
        unit=q.unit,
        question_number=q.question_number,
        question_text=q.question_text,
        question_type=q.question_type,
        has_bookmark=bookmark is not None,
        bookmark_tag=bookmark.tag if bookmark else None,
        options=options_list,
        answer=q.answer,
        explanation=wrong.explanation,
    )


@router.delete("/{question_id}")
def delete_wrong_answer(question_id: int, db: Session = Depends(get_session)):
    """오답노트에서 제거."""
    wrong = db.exec(
        select(WrongAnswer).where(WrongAnswer.question_id == question_id)
    ).first()
    if not wrong:
        raise HTTPException(status_code=404, detail="오답 이력이 없습니다.")

    db.delete(wrong)
    db.commit()
    return {"message": "오답노트에서 제거되었습니다."}


@router.post("/{question_id}/explanation", response_model=ExplanationResponse)
async def generate_explanation(question_id: int, db: Session = Depends(get_session)):
    """LLM 해설 생성. 이미 있으면 저장된 것 반환."""
    wrong = db.exec(
        select(WrongAnswer).where(WrongAnswer.question_id == question_id)
    ).first()
    if not wrong:
        raise HTTPException(status_code=404, detail="오답 이력이 없습니다.")

    # 이미 해설 있으면 즉시 반환
    if wrong.explanation:
        return ExplanationResponse(explanation=wrong.explanation)

    q = db.get(Question, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

    # LLM 호출
    try:
        from services.llm import generate_explanation as llm_explain
        options_list = None
        if q.options:
            try:
                options_list = json.loads(q.options)
            except (json.JSONDecodeError, TypeError):
                options_list = None

        explanation = await llm_explain(
            subject=q.subject,
            question_text=q.question_text,
            options=options_list,
            answer=q.answer or "",
            question_type=q.question_type,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"해설 생성 중 오류가 발생했습니다: {str(e)}")

    # DB 저장
    wrong.explanation = explanation
    db.add(wrong)
    db.commit()

    return ExplanationResponse(explanation=explanation)
