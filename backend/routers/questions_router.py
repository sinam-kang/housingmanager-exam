"""문제 조회/검색 API 라우터."""
from __future__ import annotations

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import Bookmark, Question, WrongAnswer

router = APIRouter(prefix="/api/questions", tags=["문제 조회"])


# ---------------------------------------------------------------------------
# 응답 모델
# ---------------------------------------------------------------------------

class QuestionSummary(BaseModel):
    """문제 목록 아이템."""
    id: int
    year: int
    exam_type: str
    session: Optional[str]
    subject: str
    unit: Optional[str]
    question_type: str
    question_number: int
    question_text: str
    has_bookmark: bool
    bookmark_tag: Optional[str]
    has_wrong: bool


class QuestionDetail(BaseModel):
    """문제 상세."""
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
    has_bookmark: bool
    bookmark_tag: Optional[str]
    has_wrong: bool
    wrong_count: int


class QuestionListResponse(BaseModel):
    """문제 목록 페이지 응답."""
    items: List[QuestionSummary]
    total: int
    page: int
    page_size: int


class MetaResponse(BaseModel):
    """필터용 메타데이터 응답."""
    years: List[int]
    subjects: List[str]
    units: dict  # 과목별 단원 목록: {"민법": ["임대차", ...], ...}


# ---------------------------------------------------------------------------
# 엔드포인트
# ---------------------------------------------------------------------------

@router.get("/meta", response_model=MetaResponse)
def get_meta(session: Session = Depends(get_session)):
    """필터 드롭다운에 사용할 연도/과목/단원 목록 반환.
    units는 과목별 단원 목록: {"민법": ["임대차", ...], "회계": [...]}
    """
    questions = session.exec(select(Question)).all()

    years = sorted({q.year for q in questions}, reverse=True)
    subjects = sorted({q.subject for q in questions})

    # 과목별 단원 목록 구성
    units_by_subject: dict = {}
    for q in questions:
        if q.subject not in units_by_subject:
            units_by_subject[q.subject] = set()
        if q.unit:
            units_by_subject[q.subject].add(q.unit)

    # 각 과목의 단원 목록을 정렬 (미분류는 맨 뒤)
    units: dict = {}
    for subj in subjects:
        unit_set = units_by_subject.get(subj, set())
        sorted_units = sorted(u for u in unit_set if u != "미분류")
        if "미분류" in unit_set:
            sorted_units.append("미분류")
        units[subj] = sorted_units

    return MetaResponse(years=years, subjects=subjects, units=units)


@router.get("", response_model=QuestionListResponse)
def list_questions(
    q: Optional[str] = None,
    year: Optional[int] = None,
    exam_type: Optional[str] = None,
    subject: Optional[str] = None,
    unit: Optional[str] = None,
    question_type: Optional[str] = None,
    bookmarked: Optional[bool] = None,
    wrong_only: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
    session: Session = Depends(get_session),
):
    """
    문제 목록 조회.
    필터/검색어를 조합하여 결과를 반환하고 페이지네이션을 적용한다.
    정렬: 연도 내림차순 → 문제번호 오름차순.
    """
    if page < 1:
        raise HTTPException(status_code=400, detail="page는 1 이상이어야 합니다.")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="page_size는 1~100 사이여야 합니다.")

    # 북마크/오답 집합 미리 조회
    all_bookmarks = {b.question_id: b.tag for b in session.exec(select(Bookmark)).all()}
    all_wrongs = {w.question_id for w in session.exec(select(WrongAnswer)).all()}

    stmt = select(Question)

    # 키워드 검색
    if q:
        stmt = stmt.where(Question.question_text.contains(q))  # type: ignore[union-attr]

    # 필터 적용
    if year is not None:
        stmt = stmt.where(Question.year == year)
    if exam_type:
        stmt = stmt.where(Question.exam_type == exam_type)
    if subject:
        stmt = stmt.where(Question.subject == subject)
    if unit:
        stmt = stmt.where(Question.unit == unit)
    if question_type:
        stmt = stmt.where(Question.question_type == question_type)

    # 정렬: 연도 내림차순 → 문제번호 오름차순
    stmt = stmt.order_by(Question.year.desc(), Question.question_number.asc())  # type: ignore[union-attr]

    all_questions = session.exec(stmt).all()

    # 북마크/오답 필터 (Python 레벨 필터링)
    if bookmarked:
        all_questions = [q_item for q_item in all_questions if q_item.id in all_bookmarks]
    if wrong_only:
        all_questions = [q_item for q_item in all_questions if q_item.id in all_wrongs]

    total = len(all_questions)
    offset = (page - 1) * page_size
    paged = all_questions[offset: offset + page_size]

    items = [
        QuestionSummary(
            id=q_item.id,
            year=q_item.year,
            exam_type=q_item.exam_type,
            session=q_item.session,
            subject=q_item.subject,
            unit=q_item.unit,
            question_type=q_item.question_type,
            question_number=q_item.question_number,
            question_text=q_item.question_text,
            has_bookmark=q_item.id in all_bookmarks,
            bookmark_tag=all_bookmarks.get(q_item.id),
            has_wrong=q_item.id in all_wrongs,
        )
        for q_item in paged
    ]

    return QuestionListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{question_id}", response_model=QuestionDetail)
def get_question(question_id: int, session: Session = Depends(get_session)):
    """문제 상세 조회."""
    question = session.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

    bookmark = session.exec(
        select(Bookmark).where(Bookmark.question_id == question_id)
    ).first()

    wrong = session.exec(
        select(WrongAnswer).where(WrongAnswer.question_id == question_id)
    ).first()

    # options 필드: JSON 문자열 → 리스트 변환
    options_list: Optional[List[str]] = None
    if question.options:
        try:
            options_list = json.loads(question.options)
        except (json.JSONDecodeError, TypeError):
            options_list = None

    return QuestionDetail(
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
        has_bookmark=bookmark is not None,
        bookmark_tag=bookmark.tag if bookmark else None,
        has_wrong=wrong is not None,
        wrong_count=wrong.wrong_count if wrong else 0,
    )
