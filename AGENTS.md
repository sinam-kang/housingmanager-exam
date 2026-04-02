# AGENTS.md

이 프로젝트를 작업하는 모든 AI 에이전트를 위한 규칙과 가이드.

## 프로젝트 개요
주택관리사 기출문제 PDF를 임포트하여 학습하는 개인용 로컬 웹앱.
사용자는 비개발자이므로 설치/실행은 스크립트 2개(setup.sh, start.sh)로만 이루어져야 한다.

## 필수 선행 독서
작업 시작 전 반드시 읽을 것:
1. `ARCHITECTURE.md` — 기술 스택 및 디렉토리 구조
2. `docs/product-specs/index.md` — 전체 기능 목록 및 우선순위
3. 작업 대상 기능의 스펙 파일 (`docs/product-specs/*.md`)

## 기술 스택 규칙

### 백엔드 (Python + FastAPI)
- 패키지 관리는 반드시 `uv` 사용. `pip install` 직접 사용 금지.
- 의존성 추가 시: `uv add <package>`
- 서버 실행: `uv run uvicorn backend.main:app --reload --port 8000`
- DB는 SQLite만 사용. 외부 DB 서버 도입 금지.
- ORM은 SQLModel 사용 (FastAPI + SQLite와 자연스럽게 통합).

### 프론트엔드 (Next.js)
- TypeScript 사용.
- 패키지 관리는 `npm` 사용.
- 백엔드 API 호출은 `/frontend/lib/api.ts`에 집중 관리.
- 스타일은 Tailwind CSS 사용.

### Claude SDK
- `anthropic` 패키지 사용.
- API 키는 `backend/.env`의 `ANTHROPIC_API_KEY`에서 로드. 코드에 하드코딩 금지.
- LLM 호출은 `backend/services/llm.py`에 집중 관리.
- 사용 모델: `claude-sonnet-4-6`
- LLM 호출 시점:
  - 단원 태깅: PDF 임포트 완료 후 배치 처리
  - 해설 생성: 오답노트에서 사용자가 명시적으로 요청할 때만

### PDF 파싱
- `pdfplumber` 사용.
- 파싱 로직은 `backend/services/pdf_parser.py`에 집중 관리.
- 파싱 실패 시 예외를 던지지 말고 실패 항목을 수집하여 결과에 포함.

## 코드 작성 규칙
- 함수/변수명은 영어 snake_case (백엔드), camelCase (프론트엔드).
- 주석은 한국어로 작성 (사용자가 나중에 읽을 수 있도록).
- 에러 메시지는 한국어로 표시 (사용자가 비개발자이므로).
- 복잡한 로직에만 주석 추가. 자명한 코드에 불필요한 주석 금지.

## UX 규칙
- 사용자는 비개발자. 모든 UI 텍스트는 한국어.
- 로딩이 걸리는 작업(PDF 임포트, LLM 호출)은 반드시 진행 상태를 화면에 표시.
- 에러 발생 시 기술적 메시지 대신 사용자가 이해할 수 있는 한국어 안내 표시.

## 파일 배치 규칙
- 새 API 엔드포인트: `backend/routers/` 아래 기능별 파일로 분리.
- 새 비즈니스 로직: `backend/services/` 아래 배치.
- 새 UI 페이지: `frontend/app/` 아래 Next.js 앱 라우터 규칙에 따라 배치.
- 새 공통 컴포넌트: `frontend/components/` 아래 배치.

## 하지 말 것
- 외부 DB 서버(PostgreSQL, MySQL 등) 도입 금지.
- Docker 도입 금지 (비개발자가 실행할 수 없음).
- 클라우드 배포 설정 추가 금지 (로컬 전용 앱).
- 스펙에 없는 기능 임의 추가 금지.
- `setup.sh`, `start.sh` 이외의 실행 방법 요구 금지.

## 작업 완료 기준
각 기능 구현 후 확인할 것:
- [ ] `start.sh` 실행 후 브라우저에서 정상 동작하는가
- [ ] 한국어 UI가 올바르게 표시되는가
- [ ] 에러 상황에서 사용자 친화적 메시지가 표시되는가
- [ ] 스펙 파일의 요구사항을 모두 충족하는가
