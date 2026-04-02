"""학습 통계 API 라우터."""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import Question, QuizAnswer, QuizSession, WrongAnswer

router = APIRouter(prefix="/api/stats", tags=["통계"])


# ---------------------------------------------------------------------------
# 응답 모델
# ---------------------------------------------------------------------------

class ProgressStats(BaseModel):
    total: int
    attempted: int
    rate: float


class SubjectStats(BaseModel):
    subject: str
    attempted: int
    correct: int
    rate: float


class YearStats(BaseModel):
    year: int
    attempted: int
    correct: int
    rate: float


class WeakUnit(BaseModel):
    unit: str
    attempted: int
    correct: int
    rate: float


class RecentSession(BaseModel):
    id: int
    date: str
    scope: str
    total: int
    correct: int
    rate: float


class StreakStats(BaseModel):
    current: int
    best: int


class StatsResponse(BaseModel):
    progress: ProgressStats
    by_subject: List[SubjectStats]
    by_year: List[YearStats]
    weak_units: List[WeakUnit]
    recent_sessions: List[RecentSession]
    streak: StreakStats


# ---------------------------------------------------------------------------
# 엔드포인트
# ---------------------------------------------------------------------------

@router.get("", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_session)):
    """전체 통계 한 번에 반환."""
    all_questions = db.exec(select(Question)).all()
    all_answers = db.exec(select(QuizAnswer)).all()
    all_sessions = db.exec(
        select(QuizSession).order_by(QuizSession.started_at.desc()).limit(30)  # type: ignore[union-attr]
    ).all()

    total_questions = len(all_questions)

    # 문제별 마지막 답안 계산 (마지막 풀이 결과 기준)
    # question_id → (is_correct, subject, unit, year)
    last_answer_by_question: dict[int, QuizAnswer] = {}
    for ans in sorted(all_answers, key=lambda a: a.answered_at):
        last_answer_by_question[ans.question_id] = ans

    # 문제 메타 맵
    question_map = {q.id: q for q in all_questions}

    attempted_ids = set(last_answer_by_question.keys())
    attempted = len(attempted_ids)
    progress_rate = round(attempted / total_questions, 4) if total_questions > 0 else 0.0

    # 과목별 통계
    subject_data: dict[str, dict] = defaultdict(lambda: {"attempted": 0, "correct": 0})
    for qid, ans in last_answer_by_question.items():
        q = question_map.get(qid)
        if not q:
            continue
        subject_data[q.subject]["attempted"] += 1
        if ans.is_correct:
            subject_data[q.subject]["correct"] += 1

    by_subject = [
        SubjectStats(
            subject=subj,
            attempted=data["attempted"],
            correct=data["correct"],
            rate=round(data["correct"] / data["attempted"], 4) if data["attempted"] > 0 else 0.0,
        )
        for subj, data in sorted(subject_data.items())
    ]

    # 연도별 통계
    year_data: dict[int, dict] = defaultdict(lambda: {"attempted": 0, "correct": 0})
    for qid, ans in last_answer_by_question.items():
        q = question_map.get(qid)
        if not q:
            continue
        year_data[q.year]["attempted"] += 1
        if ans.is_correct:
            year_data[q.year]["correct"] += 1

    by_year = [
        YearStats(
            year=yr,
            attempted=data["attempted"],
            correct=data["correct"],
            rate=round(data["correct"] / data["attempted"], 4) if data["attempted"] > 0 else 0.0,
        )
        for yr, data in sorted(year_data.items(), reverse=True)
    ]

    # 취약 단원 (시도 3회 이상, 정답률 낮은 순 상위 5개)
    unit_data: dict[str, dict] = defaultdict(lambda: {"attempted": 0, "correct": 0})
    for qid, ans in last_answer_by_question.items():
        q = question_map.get(qid)
        if not q or not q.unit or q.unit == "미분류":
            continue
        unit_data[q.unit]["attempted"] += 1
        if ans.is_correct:
            unit_data[q.unit]["correct"] += 1

    weak_units_raw = [
        (unit, data)
        for unit, data in unit_data.items()
        if data["attempted"] >= 3
    ]
    weak_units_raw.sort(
        key=lambda x: x[1]["correct"] / x[1]["attempted"] if x[1]["attempted"] > 0 else 0
    )
    weak_units = [
        WeakUnit(
            unit=unit,
            attempted=data["attempted"],
            correct=data["correct"],
            rate=round(data["correct"] / data["attempted"], 4) if data["attempted"] > 0 else 0.0,
        )
        for unit, data in weak_units_raw[:5]
    ]

    # 최근 퀴즈 기록
    recent_sessions = []
    for s in all_sessions:
        try:
            scope_data = json.loads(s.scope_description)
            scope_label = scope_data.get("label", s.scope_description) if isinstance(scope_data, dict) else s.scope_description
        except (json.JSONDecodeError, TypeError):
            scope_label = s.scope_description

        # 세션별 실제 답안 수 기반 correct 계산
        session_answers = [a for a in all_answers if a.session_id == s.id]
        session_correct = sum(1 for a in session_answers if a.is_correct)
        session_total = s.total
        rate = round(session_correct / session_total, 4) if session_total > 0 else 0.0

        recent_sessions.append(
            RecentSession(
                id=s.id,
                date=s.started_at.strftime("%Y-%m-%d %H:%M"),
                scope=scope_label,
                total=session_total,
                correct=session_correct,
                rate=rate,
            )
        )

    # 연속 학습일 계산
    session_dates = set()
    for s in db.exec(select(QuizSession)).all():
        session_dates.add(s.started_at.date())

    today = date.today()
    current_streak = 0
    best_streak = 0
    temp_streak = 0
    prev_streak = 0

    # 오늘 포함 연속일 계산
    check_day = today
    while check_day in session_dates:
        current_streak += 1
        check_day -= timedelta(days=1)

    # 최장 연속일 계산
    if session_dates:
        sorted_dates = sorted(session_dates)
        temp_streak = 1
        best_streak = 1
        for i in range(1, len(sorted_dates)):
            if (sorted_dates[i] - sorted_dates[i - 1]).days == 1:
                temp_streak += 1
                best_streak = max(best_streak, temp_streak)
            else:
                temp_streak = 1

    return StatsResponse(
        progress=ProgressStats(total=total_questions, attempted=attempted, rate=progress_rate),
        by_subject=by_subject,
        by_year=by_year,
        weak_units=weak_units,
        recent_sessions=recent_sessions,
        streak=StreakStats(current=current_streak, best=best_streak),
    )
