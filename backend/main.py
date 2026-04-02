"""FastAPI 앱 진입점."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import create_db_and_tables
import models  # noqa: F401 — SQLModel metadata 등록을 위해 반드시 import
from routers import import_router
from routers import questions_router
from routers import quiz_router
from routers import wrong_answers_router
from routers import stats_router
from routers import bookmarks_router

app = FastAPI(
    title="주택관리사 기출문제 API",
    description="주택관리사 기출문제 학습 앱 백엔드",
    version="0.1.0",
)

# CORS 설정: 프론트엔드(localhost:3000)에서의 요청만 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(import_router.router)
app.include_router(questions_router.router)
app.include_router(quiz_router.router)
app.include_router(wrong_answers_router.router)
app.include_router(stats_router.router)
app.include_router(bookmarks_router.router)


@app.on_event("startup")
def on_startup():
    """앱 시작 시 DB 테이블 자동 생성."""
    create_db_and_tables()


@app.get("/health")
def health_check():
    """서버 상태 확인 엔드포인트."""
    return {"status": "ok", "message": "서버가 정상 동작 중입니다."}
