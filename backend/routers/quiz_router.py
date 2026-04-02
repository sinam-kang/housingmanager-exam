"""퀴즈 모드 API 라우터."""
from __future__ import annotations

import json
import random
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import Bookmark, Question, QuizAnswer, QuizSession, WrongAnswer

router = APIRouter(prefix="/api/quiz", tags=["퀴즈"])


# ---------------------------------------------------------------------------
# 요청/응답 모델
# ---------------------------------------------------------------------------

class FilterBody(BaseModel):
    """퀴즈 필터 조건."""
    year: Optional[int] = None
    exam_type: Optional[str] = None
    subject: Optional[str] = None
    unit: Optional[str] = None
    question_type: Optional[str] = None
    bookmarked: Optional[bool] = None
    wrong_only: Optional[bool] = None


class StartQuizRequest(BaseModel):
    """퀴즈 시작 요청."""
    filter: Optional[FilterBody] = None
    mode: str = "ordered"   # "ordered" | "random"
    limit: Optional[int] = None  # 최대 문제 수 (None이면 전체)


class StartQuizResponse(BaseModel):
    session_id: int
    total: int
    first_question_id: int


class QuizQuestionResponse(BaseModel):
    """퀴즈 진행 중 문제 응답."""
    id: int
    year: int
    exam_type: str
    session: Optional[str]
    subject: str
    unit: Optional[str]
    question_type: str
    question_number: int
    question_text: str
    options: Optional[List[str]]
    answer: Optional[str]
    index: int
    total: int


class SubmitAnswerRequest(BaseModel):
    """답안 제출 요청."""
    question_id: int
    user_answer: str
    index: int


class SubmitAnswerResponse(BaseModel):
    is_correct: bool
    correct_answer: Optional[str]
    is_last: bool


class WrongQuestionSummary(BaseModel):
    id: int
    year: int
    subject: str
    question_number: int
    question_text: str


class QuizResultResponse(BaseModel):
    total: int
    correct: int
    wrong: int
    rate: float
    wrong_questions: List[WrongQuestionSummary]


class SessionSummary(BaseModel):
    id: int
    started_at: datetime
    ended_at: Optional[datetime]
    total: int
    correct: int
    scope_description: str
    rate: float


# ---------------------------------------------------------------------------
# 헬퍼 — 세션에 저장된 question_id 목록 조회
# ---------------------------------------------------------------------------

def _get_session_question_ids(quiz_session: QuizSession) -> List[int]:
    """QuizSession.scope_description에서 question_id 목록 복원."""
    try:
        data = json.loads(quiz_session.scope_description)
        if isinstance(data, dict) and "question_ids" in data:
            return data["question_ids"]
    except (json.JSONDecodeError, TypeError):
        pass
    return []


# ---------------------------------------------------------------------------
# 엔드포인트
# ---------------------------------------------------------------------------

@router.post("/start", response_model=StartQuizResponse)
def start_quiz(body: StartQuizRequest, db: Session = Depends(get_session)):
    """퀴즈 세션 생성."""
    f = body.filter or FilterBody()

    # 북마크/오답 집합 미리 조회
    all_bookmarks = {b.question_id for b in db.exec(select(Bookmark)).all()}
    all_wrongs = {w.question_id for w in db.exec(select(WrongAnswer)).all()}

    stmt = select(Question)
    if f.year is not None:
        stmt = stmt.where(Question.year == f.year)
    if f.exam_type:
        stmt = stmt.where(Question.exam_type == f.exam_type)
    if f.subject:
        stmt = stmt.where(Question.subject == f.subject)
    if f.unit:
        stmt = stmt.where(Question.unit == f.unit)
    if f.question_type:
        stmt = stmt.where(Question.question_type == f.question_type)

    # 정렬: 연도 내림차순 → 문제번호 오름차순
    stmt = stmt.order_by(Question.year.desc(), Question.question_number.asc())  # type: ignore[union-attr]

    questions = db.exec(stmt).all()

    # 북마크/오답 필터
    if f.bookmarked:
        questions = [q for q in questions if q.id in all_bookmarks]
    if f.wrong_only:
        questions = [q for q in questions if q.id in all_wrongs]

    if not questions:
        raise HTTPException(status_code=404, detail="조건에 맞는 문제가 없습니다.")

    # 셔플 또는 순서대로
    question_ids = [q.id for q in questions]
    if body.mode == "random":
        random.shuffle(question_ids)

    # 문제 수 제한
    if body.limit and body.limit > 0:
        question_ids = question_ids[: body.limit]

    total = len(question_ids)

    # 범위 설명 생성 (scope_description에 question_ids도 저장)
    parts = []
    if f.year:
        parts.append(f"{f.year}년")
    if f.exam_type:
        parts.append(f.exam_type)
    if f.subject:
        parts.append(f.subject)
    if f.unit:
        parts.append(f.unit)
    if f.bookmarked:
        parts.append("북마크")
    if f.wrong_only:
        parts.append("오답만")
    scope_label = " ".join(parts) if parts else "전체"

    scope_data = json.dumps({"label": scope_label, "question_ids": question_ids}, ensure_ascii=False)

    session = QuizSession(
        total=total,
        correct=0,
        scope_description=scope_data,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return StartQuizResponse(
        session_id=session.id,
        total=total,
        first_question_id=question_ids[0],
    )


@router.get("/sessions", response_model=List[SessionSummary])
def list_sessions(db: Session = Depends(get_session)):
    """최근 퀴즈 세션 목록 (최근 30개)."""
    sessions = db.exec(
        select(QuizSession).order_by(QuizSession.started_at.desc()).limit(30)  # type: ignore[union-attr]
    ).all()

    result = []
    for s in sessions:
        rate = round(s.correct / s.total, 4) if s.total > 0 else 0.0
        # scope_description에서 label 추출
        try:
            data = json.loads(s.scope_description)
            label = data.get("label", s.scope_description) if isinstance(data, dict) else s.scope_description
        except (json.JSONDecodeError, TypeError):
            label = s.scope_description

        result.append(
            SessionSummary(
                id=s.id,
                started_at=s.started_at,
                ended_at=s.ended_at,
                total=s.total,
                correct=s.correct,
                scope_description=label,
                rate=rate,
            )
        )
    return result


@router.get("/{session_id}/question/{index}", response_model=QuizQuestionResponse)
def get_quiz_question(session_id: int, index: int, db: Session = Depends(get_session)):
    """퀴즈 세션의 N번째 문제 조회 (0-based index)."""
    quiz_session = db.get(QuizSession, session_id)
    if not quiz_session:
        raise HTTPException(status_code=404, detail="퀴즈 세션을 찾을 수 없습니다.")

    question_ids = _get_session_question_ids(quiz_session)
    if not question_ids:
        raise HTTPException(status_code=404, detail="세션에 문제가 없습니다.")

    if index < 0 or index >= len(question_ids):
        raise HTTPException(status_code=400, detail="유효하지 않은 문제 인덱스입니다.")

    question = db.get(Question, question_ids[index])
    if not question:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

    options_list = None
    if question.options:
        try:
            options_list = json.loads(question.options)
        except (json.JSONDecodeError, TypeError):
            options_list = None

    return QuizQuestionResponse(
        id=question.id,
        year=question.year,
        exam_type=question.exam_type,
        session=question.session,
        subject=question.subject,
        unit=question.unit,
        question_type=question.question_type,
        question_number=question.question_number,
        question_text=question.question_text,
        options=options_list,
        answer=question.answer,
        index=index,
        total=len(question_ids),
    )


@router.post("/{session_id}/answer", response_model=SubmitAnswerResponse)
def submit_answer(session_id: int, body: SubmitAnswerRequest, db: Session = Depends(get_session)):
    """답안 제출 및 맞음/틀림 판정."""
    quiz_session = db.get(QuizSession, session_id)
    if not quiz_session:
        raise HTTPException(status_code=404, detail="퀴즈 세션을 찾을 수 없습니다.")

    question = db.get(Question, body.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

    # 맞음/틀림 판정
    correct_answer = question.answer or ""
    is_correct = body.user_answer.strip() == correct_answer.strip()

    # QuizAnswer 저장
    quiz_answer = QuizAnswer(
        session_id=session_id,
        question_id=body.question_id,
        user_answer=body.user_answer,
        is_correct=is_correct,
    )
    db.add(quiz_answer)

    # 맞히면 세션의 correct 카운트 증가
    if is_correct:
        quiz_session.correct += 1

    # 틀린 경우: WrongAnswer upsert
    if not is_correct:
        existing_wrong = db.exec(
            select(WrongAnswer).where(WrongAnswer.question_id == body.question_id)
        ).first()
        if existing_wrong:
            existing_wrong.wrong_count += 1
            existing_wrong.last_wrong_at = datetime.utcnow()
            db.add(existing_wrong)
        else:
            wrong = WrongAnswer(
                question_id=body.question_id,
                wrong_count=1,
                last_wrong_at=datetime.utcnow(),
            )
            db.add(wrong)

    # 마지막 문제 여부 확인
    question_ids = _get_session_question_ids(quiz_session)
    is_last = body.index >= len(question_ids) - 1

    # 마지막 문제면 세션 종료 시각 기록
    if is_last:
        quiz_session.ended_at = datetime.utcnow()
        db.add(quiz_session)

    db.commit()

    return SubmitAnswerResponse(
        is_correct=is_correct,
        correct_answer=correct_answer,
        is_last=is_last,
    )


@router.get("/{session_id}/result", response_model=QuizResultResponse)
def get_quiz_result(session_id: int, db: Session = Depends(get_session)):
    """퀴즈 세션 결과 조회."""
    quiz_session = db.get(QuizSession, session_id)
    if not quiz_session:
        raise HTTPException(status_code=404, detail="퀴즈 세션을 찾을 수 없습니다.")

    # 이 세션의 답안 조회
    answers = db.exec(
        select(QuizAnswer).where(QuizAnswer.session_id == session_id)
    ).all()

    total = quiz_session.total
    correct = sum(1 for a in answers if a.is_correct)
    wrong = total - correct
    rate = round(correct / total, 4) if total > 0 else 0.0

    # 오답 문제 목록
    wrong_question_ids = [a.question_id for a in answers if not a.is_correct]
    wrong_questions = []
    for qid in wrong_question_ids:
        q = db.get(Question, qid)
        if q:
            wrong_questions.append(
                WrongQuestionSummary(
                    id=q.id,
                    year=q.year,
                    subject=q.subject,
                    question_number=q.question_number,
                    question_text=q.question_text,
                )
            )

    return QuizResultResponse(
        total=total,
        correct=correct,
        wrong=wrong,
        rate=rate,
        wrong_questions=wrong_questions,
    )
