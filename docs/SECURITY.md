# Security

## 기본 전제
로컬 전용 앱. 외부 네트워크에 노출되지 않으므로 보안 위협이 최소화된다.
단, API 키 보호와 로컬 데이터 보호는 반드시 지킨다.

## API 키 보호

### Anthropic API 키
- `backend/.env` 파일에만 저장
- `.env` 파일은 `.gitignore`에 반드시 포함 — 절대 커밋하지 않는다
- `backend/.env.example` 파일로 키 형식만 안내
- 코드 내 하드코딩 금지
- 프론트엔드로 API 키 노출 금지 — LLM 호출은 반드시 백엔드에서만

## 로컬 데이터 보호
- DB 파일(`data/db.sqlite`)과 PDF 파일(`data/exams/`)은 `.gitignore`에 포함
- 시험 문제 데이터가 원격 저장소에 업로드되지 않도록 한다

## 입력 검증
- PDF 파일 경로 입력 시 경로 탐색 공격(path traversal) 방지
  - 허용 경로: `data/exams/` 하위 디렉토리만
- API 엔드포인트 입력값 타입 검증 (FastAPI Pydantic 모델 활용)

## 네트워크
- 백엔드 서버는 `localhost`(127.0.0.1)에서만 수신 — 외부 IP 바인딩 금지
- CORS 설정: `localhost:3000`에서의 요청만 허용

## .gitignore 필수 항목
```
backend/.env
data/db.sqlite
data/exams/
```
