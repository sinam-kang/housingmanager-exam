"""SQLite DB 연결 설정."""
import os
from pathlib import Path

from sqlmodel import SQLModel, create_engine, Session

# DB 파일 경로: 프로젝트 루트의 data/db.sqlite
BASE_DIR = Path(__file__).parent.parent
DB_PATH = BASE_DIR / "data" / "db.sqlite"

# data 폴더가 없으면 생성
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # FastAPI 멀티스레드 환경 대응
)


def create_db_and_tables():
    """DB 파일 생성 및 테이블 초기화."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """FastAPI 의존성 주입용 DB 세션 생성기."""
    with Session(engine) as session:
        yield session
