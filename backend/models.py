"""DB 모델 정의 (SQLModel 사용)."""
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Question(SQLModel, table=True):
    """기출문제 원본 데이터."""
    __tablename__ = "questions"

    id: Optional[int] = Field(default=None, primary_key=True)
    year: int = Field(description="출제 연도")
    exam_type: str = Field(description="시험 차수: '1차' 또는 '2차'")
    session: Optional[str] = Field(default=None, description="교시: '1교시' 또는 '2교시' (1차 시험만 해당)")
    subject: str = Field(description="과목명")
    question_type: str = Field(description="문제 유형: '객관식' 또는 '주관식'")
    question_number: int = Field(description="문제 번호")
    question_text: str = Field(description="문제 본문")
    options: Optional[str] = Field(default=None, description="보기 목록 (JSON 배열 문자열, 객관식만)")
    answer: Optional[str] = Field(default=None, description="정답")
    unit: Optional[str] = Field(default="미분류", description="단원명 (LLM 태깅)")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class QuizSession(SQLModel, table=True):
    """퀴즈 세션 기록."""
    __tablename__ = "quiz_sessions"

    id: Optional[int] = Field(default=None, primary_key=True)
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = Field(default=None)
    total: int = Field(description="총 문제 수")
    correct: int = Field(default=0, description="맞힌 문제 수")
    scope_description: str = Field(description="퀴즈 범위 설명 (예: '2023년 1차 전체')")


class QuizAnswer(SQLModel, table=True):
    """퀴즈 세션 내 개별 문제 답안."""
    __tablename__ = "quiz_answers"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="quiz_sessions.id", description="퀴즈 세션 ID")
    question_id: int = Field(foreign_key="questions.id", description="문제 ID")
    user_answer: str = Field(description="사용자 제출 답안")
    is_correct: bool = Field(description="정답 여부")
    answered_at: datetime = Field(default_factory=datetime.utcnow)


class WrongAnswer(SQLModel, table=True):
    """오답노트 — 틀린 문제를 누적 관리."""
    __tablename__ = "wrong_answers"

    id: Optional[int] = Field(default=None, primary_key=True)
    question_id: int = Field(foreign_key="questions.id", unique=True, description="문제 ID")
    wrong_count: int = Field(default=1, description="오답 횟수")
    last_wrong_at: datetime = Field(default_factory=datetime.utcnow, description="마지막 오답 일시")
    explanation: Optional[str] = Field(default=None, description="LLM 생성 해설")


class Bookmark(SQLModel, table=True):
    """북마크 — 문제에 태그를 붙여 저장."""
    __tablename__ = "bookmarks"

    id: Optional[int] = Field(default=None, primary_key=True)
    question_id: int = Field(foreign_key="questions.id", unique=True, description="문제 ID")
    tag: str = Field(description="태그: '중요', '어려움', '나중에'")
    created_at: datetime = Field(default_factory=datetime.utcnow)
