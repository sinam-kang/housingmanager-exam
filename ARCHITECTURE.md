# Architecture

## 앱 형태
로컬 웹앱 — 브라우저에서 `localhost:3000` 접속하여 사용.
서버는 본인 PC에서만 실행되며 외부 접근 없음.

## 기술 스택

| 역할 | 기술 |
|------|------|
| 백엔드 | Python 3.12 + FastAPI |
| 패키지 관리 | uv |
| 프론트엔드 | Next.js (React, TypeScript) |
| DB | SQLite (파일 1개로 관리) |
| LLM | Claude SDK (Anthropic) |
| PDF 파싱 | pdfplumber |

## 디렉토리 구조

```
housingmanager-exam/
├── backend/
│   ├── main.py            # FastAPI 앱 진입점
│   ├── routers/           # API 라우터 (문제, 퀴즈, 오답, 통계 등)
│   ├── services/          # 비즈니스 로직 (PDF 파싱, LLM 호출 등)
│   ├── models.py          # DB 모델 (SQLite)
│   └── pyproject.toml     # uv 패키지 설정
├── frontend/
│   ├── app/               # Next.js 앱 라우터
│   ├── components/        # UI 컴포넌트
│   └── package.json
├── data/
│   ├── exams/             # 사용자 PDF 파일 보관 위치
│   │   └── 2024/
│   │       ├── 1차 1교시 문제.pdf
│   │       └── ...
│   └── db.sqlite          # SQLite DB 파일
├── setup.sh               # 최초 1회 설치 스크립트
└── start.sh               # 앱 실행 스크립트
```

## API 구조
백엔드(FastAPI, port 8000)와 프론트엔드(Next.js, port 3000)가 분리.
프론트엔드에서 백엔드 REST API 호출.

## LLM 사용 (Claude SDK)
| 기능 | 호출 시점 |
|------|----------|
| 단원 자동 태깅 | PDF 임포트 완료 후 배치 처리 |
| 오답 해설 생성 | 오답노트에서 "해설 보기" 버튼 클릭 시 |

Claude API 키는 `backend/.env` 파일에 저장:
```
ANTHROPIC_API_KEY=your_api_key_here
```

## 실행 방법 (사용자)
```bash
# 최초 1회 설치
./setup.sh

# 매번 사용 시
./start.sh
# → 브라우저에서 http://localhost:3000 접속
```

## DB 스키마 개요
상세 스키마 → `docs/generated/db-schema.md` (에이전트가 생성)

주요 테이블:
- `questions` — 문제 원본 데이터
- `quiz_sessions` — 퀴즈 세션 이력
- `quiz_answers` — 문제별 풀이 결과
- `wrong_answers` — 오답노트
- `bookmarks` — 북마크
