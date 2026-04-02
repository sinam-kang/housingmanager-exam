"""북마크 API 라우터."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import Bookmark, Question, WrongAnswer

router = APIRouter(prefix="/api/bookmarks", tags=["북마크"])


# ---------------------------------------------------------------------------
# 응답 모델
# ---------------------------------------------------------------------------

class BookmarkItem(BaseModel):
    """북마크 목록 아이템."""
    id: int
    question_id: int
    tag: str
    created_at: str
    # 문제 정보
    year: int
    exam_type: str
    session: Optional[str]
    subject: str
    unit: Optional[str]
    question_number: int
    question_text: str
    has_wrong: bool


class BookmarkListResponse(BaseModel):
    items: List[BookmarkItem]
    total: int


class AddBookmarkRequest(BaseModel):
    question_id: int
    tag: str  # "중요" | "어려움" | "나중에"


class BookmarkResponse(BaseModel):
    question_id: int
    tag: str


# ---------------------------------------------------------------------------
# 엔드포인트
# ---------------------------------------------------------------------------

VALID_TAGS = {"중요", "어려움", "나중에"}


@router.get("", response_model=BookmarkListResponse)
def list_bookmarks(
    tag: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_session),
):
    """북마크 목록 조회."""
    if page < 1:
        raise HTTPException(status_code=400, detail="page는 1 이상이어야 합니다.")

    stmt = select(Bookmark)
    if tag:
        stmt = stmt.where(Bookmark.tag == tag)
    stmt = stmt.order_by(Bookmark.created_at.desc())  # type: ignore[union-attr]

    bookmarks = db.exec(stmt).all()
    total = len(bookmarks)

    offset = (page - 1) * page_size
    paged = bookmarks[offset: offset + page_size]

    all_wrongs = {w.question_id for w in db.exec(select(WrongAnswer)).all()}

    items = []
    for b in paged:
        q = db.get(Question, b.question_id)
        if not q:
            continue
        items.append(
            BookmarkItem(
                id=b.id,
                question_id=b.question_id,
                tag=b.tag,
                created_at=b.created_at.isoformat(),
                year=q.year,
                exam_type=q.exam_type,
                session=q.session,
                subject=q.subject,
                unit=q.unit,
                question_number=q.question_number,
                question_text=q.question_text,
                has_wrong=b.question_id in all_wrongs,
            )
        )

    return BookmarkListResponse(items=items, total=total)


@router.post("", response_model=BookmarkResponse)
def add_or_update_bookmark(body: AddBookmarkRequest, db: Session = Depends(get_session)):
    """북마크 추가 또는 태그 업데이트."""
    if body.tag not in VALID_TAGS:
        raise HTTPException(
            status_code=400,
            detail=f"유효하지 않은 태그입니다. 사용 가능한 태그: {', '.join(VALID_TAGS)}",
        )

    question = db.get(Question, body.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

    existing = db.exec(
        select(Bookmark).where(Bookmark.question_id == body.question_id)
    ).first()

    if existing:
        existing.tag = body.tag
        db.add(existing)
    else:
        bookmark = Bookmark(question_id=body.question_id, tag=body.tag)
        db.add(bookmark)

    db.commit()
    return BookmarkResponse(question_id=body.question_id, tag=body.tag)


@router.delete("/{question_id}")
def delete_bookmark(question_id: int, db: Session = Depends(get_session)):
    """북마크 제거."""
    bookmark = db.exec(
        select(Bookmark).where(Bookmark.question_id == question_id)
    ).first()
    if not bookmark:
        raise HTTPException(status_code=404, detail="북마크가 없습니다.")

    db.delete(bookmark)
    db.commit()
    return {"message": "북마크가 제거되었습니다."}
