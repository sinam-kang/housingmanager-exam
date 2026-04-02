#!/usr/bin/env bash
# start.sh — 백엔드와 프론트엔드를 동시에 실행합니다.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export PATH="$HOME/.local/bin:$PATH"

# ─── uv 설치 확인 ───────────────────────────────────────────
if ! command -v uv &> /dev/null; then
  echo "오류: uv가 설치되어 있지 않습니다. ./setup.sh 를 먼저 실행해 주세요."
  exit 1
fi

# ─── 프론트엔드 의존성 확인 ─────────────────────────────────
if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
  echo "오류: 프론트엔드 의존성이 설치되어 있지 않습니다. ./setup.sh 를 먼저 실행해 주세요."
  exit 1
fi

echo "=== 주택관리사 기출문제 앱 시작 ==="
echo ""

# 백그라운드 프로세스 PID를 저장할 변수
BACKEND_PID=""
FRONTEND_PID=""

# Ctrl+C 시 두 프로세스 모두 종료
cleanup() {
  echo ""
  echo "앱을 종료합니다..."
  if [ -n "$BACKEND_PID" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "$FRONTEND_PID" ]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  exit 0
}
trap cleanup INT TERM

# ─── 백엔드 실행 ────────────────────────────────────────────
echo "백엔드 서버 시작 중... (http://localhost:8000)"
cd "$SCRIPT_DIR/backend"
uv run uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# ─── 프론트엔드 실행 ────────────────────────────────────────
echo "프론트엔드 서버 시작 중... (http://localhost:3000)"
cd "$SCRIPT_DIR/frontend"
npm run dev -- --port 3000 &
FRONTEND_PID=$!

echo ""
echo "  브라우저에서 http://localhost:3000 에 접속하세요."
echo "  종료하려면 Ctrl+C 를 누르세요."
echo ""

# 두 프로세스가 모두 종료될 때까지 대기
wait "$BACKEND_PID" "$FRONTEND_PID"
