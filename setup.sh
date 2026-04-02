#!/usr/bin/env bash
# setup.sh — 최초 1회 실행하여 환경을 설정합니다.

set -e

echo "=== 주택관리사 기출문제 앱 설치 시작 ==="
echo ""

# 스크립트 위치 기준으로 프로젝트 루트 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ─── uv 설치 확인 ───────────────────────────────────────────
if ! command -v uv &> /dev/null; then
  echo "[1/4] uv 패키지 관리자 설치 중..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  # 현재 세션에 PATH 반영
  export PATH="$HOME/.local/bin:$PATH"
  echo "    uv 설치 완료."
else
  echo "[1/4] uv 이미 설치되어 있습니다. ($(uv --version))"
fi

export PATH="$HOME/.local/bin:$PATH"

# ─── 백엔드 의존성 설치 ─────────────────────────────────────
echo ""
echo "[2/4] 백엔드 의존성 설치 중..."
cd "$SCRIPT_DIR/backend"
uv sync
echo "    백엔드 의존성 설치 완료."
cd "$SCRIPT_DIR"

# ─── 프론트엔드 의존성 설치 ─────────────────────────────────
echo ""
echo "[3/4] 프론트엔드 의존성 설치 중..."
cd "$SCRIPT_DIR/frontend"
npm install
echo "    프론트엔드 의존성 설치 완료."
cd "$SCRIPT_DIR"

# ─── .env 파일 설정 ─────────────────────────────────────────
echo ""
echo "[4/4] 환경 설정 파일 확인 중..."
if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
  cp "$SCRIPT_DIR/backend/.env.example" "$SCRIPT_DIR/backend/.env"
  echo "    backend/.env 파일이 생성되었습니다."
  echo ""
  echo "  ⚠️  Anthropic API 키를 설정해야 합니다:"
  echo "     backend/.env 파일을 열어 ANTHROPIC_API_KEY= 뒤에 실제 키를 입력하세요."
  echo "     (LLM 해설 기능을 사용하지 않으면 없어도 됩니다.)"
else
  echo "    backend/.env 파일이 이미 존재합니다."
fi

# ─── data/exams 폴더 생성 ───────────────────────────────────
mkdir -p "$SCRIPT_DIR/data/exams"
echo ""
echo "=== 설치 완료 ==="
echo ""
echo "  기출문제 PDF 파일은 data/exams/ 폴더에 넣어주세요."
echo "  앱 실행: ./start.sh"
echo ""
