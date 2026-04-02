"""PDF 파싱 서비스 — 주택관리사 기출문제 PDF에서 문제/정답 추출."""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# pdfplumber는 선택적 import (파일 없을 때도 서버 기동 가능)
try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

# 프로젝트 루트 기준 data/exams 경로
BASE_DIR = Path(__file__).parent.parent.parent
EXAMS_DIR = BASE_DIR / "data" / "exams"


# ---------------------------------------------------------------------------
# 파일명 패턴 분류
# ---------------------------------------------------------------------------

def classify_file(filename: str) -> Dict:
    """
    파일명 패턴으로 파일 유형 분류.
    반환: {role: 'question'|'answer', exam_type: '1차'|'2차', session: ..., answer_kind: ...}
    """
    name = filename.strip()

    # 1차 1교시 문제
    if re.search(r"1차.*1교시.*문제", name):
        return {"role": "question", "exam_type": "1차", "session": "1교시"}
    # 1차 2교시 문제
    if re.search(r"1차.*2교시.*문제", name):
        return {"role": "question", "exam_type": "1차", "session": "2교시"}
    # 2차 시험 문제
    if re.search(r"2차.*문제", name):
        return {"role": "question", "exam_type": "2차", "session": None}
    # 1차 정답
    if re.search(r"1차.*정답", name):
        return {"role": "answer", "exam_type": "1차", "answer_kind": "all"}
    # 2차 객관식 정답
    if re.search(r"2차.*객관식.*정답", name):
        return {"role": "answer", "exam_type": "2차", "answer_kind": "객관식"}
    # 2차 주관식 정답
    if re.search(r"2차.*주관식.*정답", name):
        return {"role": "answer", "exam_type": "2차", "answer_kind": "주관식"}

    return {"role": "unknown"}


# ---------------------------------------------------------------------------
# 텍스트 추출
# ---------------------------------------------------------------------------

def extract_text_from_pdf(pdf_path: Path) -> List[str]:
    """PDF 각 페이지의 텍스트를 리스트로 반환."""
    if not PDFPLUMBER_AVAILABLE:
        raise RuntimeError("pdfplumber 패키지가 설치되어 있지 않습니다.")
    pages = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            pages.append(text)
    return pages


# ---------------------------------------------------------------------------
# 과목 헤더 파싱
# ---------------------------------------------------------------------------

# 구형식 과목 헤더: "제1과목 민법", "제 2 과목 회계원리" 등
SUBJECT_HEADER_RE = re.compile(
    r"제\s*(\d+)\s*과목\s+([^\n]+)"
)

# 신형식(2025+): 페이지 첫 줄이 한글 2~15자 단독 → 과목명
BARE_SUBJECT_RE = re.compile(r"^[가-힣]{2,15}$")


def split_by_subject(full_text: str) -> List[Tuple[str, str]]:
    """
    전체 텍스트를 과목 헤더(구형식) 기준으로 분리.
    반환: [(과목명, 해당 과목 텍스트), ...]
    """
    matches = list(SUBJECT_HEADER_RE.finditer(full_text))
    if not matches:
        return [("미분류", full_text)]

    segments = []
    for i, m in enumerate(matches):
        subject_raw = m.group(2).strip()
        # 과목명에서 불필요한 부분 제거 (줄바꿈 등)
        subject = subject_raw.split("\n")[0].strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(full_text)
        segments.append((subject, full_text[start:end]))

    return segments


def split_pages_by_subject(pages: List[str]) -> List[Tuple[str, str]]:
    """
    페이지 목록을 과목 기준으로 분리. 두 가지 형식 지원:
      - 구형식: "제N과목 XXX" 헤더 (임의 위치)
      - 신형식(2025+): 페이지 첫 줄이 과목명 단독 (한글 2~15자)
    반환: [(과목명, 해당 과목 텍스트), ...]
    """
    full_text = "\n".join(pages)

    # 구형식 먼저 시도
    if SUBJECT_HEADER_RE.search(full_text):
        return split_by_subject(full_text)

    # 신형식: 페이지 첫 줄이 과목명 단독인 경우
    current_subject = "미분류"
    current_parts: List[str] = []
    segments: List[Tuple[str, str]] = []

    for page_text in pages:
        lines = page_text.split("\n")
        first_line = lines[0].strip() if lines else ""

        if BARE_SUBJECT_RE.match(first_line):
            if current_parts:
                segments.append((current_subject, "\n".join(current_parts)))
            current_subject = first_line
            rest = "\n".join(lines[1:]).strip()
            current_parts = [rest] if rest else []
        else:
            current_parts.append(page_text)

    if current_parts:
        segments.append((current_subject, "\n".join(current_parts)))

    return segments if segments else [("미분류", full_text)]


# ---------------------------------------------------------------------------
# 문제 번호 파싱
# ---------------------------------------------------------------------------

# 다양한 문제 번호 패턴
QUESTION_NUMBER_RE = re.compile(
    r"(?:^|\n)\s*(?:문\s*)?(\d{1,3})\s*[\.．]\s*(?!\d)"
)


def split_into_questions(subject_text: str) -> List[Tuple[int, str]]:
    """
    과목 텍스트를 문제 번호 기준으로 분리.
    반환: [(문제번호, 문제텍스트), ...]
    """
    matches = list(QUESTION_NUMBER_RE.finditer(subject_text))
    if not matches:
        return []

    questions = []
    for i, m in enumerate(matches):
        num = int(m.group(1))
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(subject_text)
        text = subject_text[start:end].strip()
        questions.append((num, text))

    return questions


# ---------------------------------------------------------------------------
# 보기 추출
# ---------------------------------------------------------------------------

# 원문자 보기: ① ② ③ ④ ⑤
CIRCLED_OPTION_RE = re.compile(r"[①②③④⑤]([^①②③④⑤]+)")
CIRCLED_NUMS = "①②③④⑤"

# 숫자+괄호 보기: 1) 2) 3) 4) 5)
PAREN_OPTION_RE = re.compile(r"(?:^|\n)\s*([1-5])\)\s*(.+?)(?=\n\s*[1-5]\)|\Z)", re.DOTALL)


def extract_options(text: str) -> Optional[List[str]]:
    """
    문제 텍스트에서 보기 목록 추출.
    반환: 보기 5개 리스트 또는 None (주관식)
    """
    # ① ② ... 패턴 우선
    if any(c in text for c in CIRCLED_NUMS):
        options = []
        for c in CIRCLED_NUMS:
            idx = text.find(c)
            if idx == -1:
                break
            # 다음 원문자 또는 끝까지
            next_idx = len(text)
            for nc in CIRCLED_NUMS:
                ni = text.find(nc, idx + 1)
                if ni != -1 and ni < next_idx:
                    next_idx = ni
            opt_text = text[idx + 1:next_idx].strip()
            # 줄바꿈 정리
            opt_text = re.sub(r"\s+", " ", opt_text)
            options.append(opt_text)
        if options:
            return options

    # 1) 2) 3) ... 패턴
    paren_matches = PAREN_OPTION_RE.findall(text)
    if paren_matches and len(paren_matches) >= 3:
        return [m[1].strip() for m in paren_matches]

    return None


def get_question_type(options: Optional[List]) -> str:
    """보기 존재 여부로 문제 유형 결정."""
    return "객관식" if options else "주관식"


def clean_question_text(text: str, options: Optional[List]) -> str:
    """문제 텍스트에서 보기 부분 제거."""
    if not options:
        return text.strip()

    # 첫 번째 보기 시작점까지만 추출
    for c in CIRCLED_NUMS:
        idx = text.find(c)
        if idx != -1:
            return text[:idx].strip()

    paren_m = PAREN_OPTION_RE.search(text)
    if paren_m:
        return text[:paren_m.start()].strip()

    return text.strip()


# ---------------------------------------------------------------------------
# 정답 파일 파싱
# ---------------------------------------------------------------------------

# 정답 패턴: "1. ③", "1 ③", "1. 3", "1.③" 등
ANSWER_RE = re.compile(
    r"(\d{1,3})\s*[\.．]?\s*([①②③④⑤1-5]|[가-힣]{1,10})"
)

# 원문자 → 숫자 변환
CIRCLED_TO_NUM = {"①": "1", "②": "2", "③": "3", "④": "4", "⑤": "5"}


def parse_answer_text(text: str) -> Dict[int, str]:
    """
    정답 텍스트에서 {문제번호: 정답} 딕셔너리 추출.
    """
    answers: Dict[int, str] = {}
    for m in ANSWER_RE.finditer(text):
        num = int(m.group(1))
        ans = m.group(2).strip()
        # 원문자를 숫자로 변환
        if ans in CIRCLED_TO_NUM:
            ans = CIRCLED_TO_NUM[ans]
        answers[num] = ans
    return answers


def split_answer_by_session(full_text: str) -> Tuple[Dict[int, str], Dict[int, str]]:
    """
    1차 정답.pdf에서 1교시/2교시 정답 분리.
    구분자: "1교시", "2교시" 텍스트 기준.
    반환: (1교시 정답 dict, 2교시 정답 dict)
    """
    # 2교시 구분자 찾기
    session2_match = re.search(r"2교시", full_text)
    if not session2_match:
        # 구분 없으면 전체를 1교시로 처리
        return parse_answer_text(full_text), {}

    session1_text = full_text[:session2_match.start()]
    session2_text = full_text[session2_match.start():]

    return parse_answer_text(session1_text), parse_answer_text(session2_text)


# ---------------------------------------------------------------------------
# 메인 파싱 함수
# ---------------------------------------------------------------------------

def parse_exam_folder(year: int) -> Dict:
    """
    data/exams/{year}/ 폴더의 PDF를 파싱하여 문제 목록 반환.

    반환 형태:
    {
        "questions": [Question-like dict, ...],
        "failed": [{"reason": "...", "page": N, "text": "..."}, ...]
    }
    """
    year_dir = EXAMS_DIR / str(year)
    if not year_dir.exists():
        raise FileNotFoundError(f"연도 폴더를 찾을 수 없습니다: {year_dir}")

    questions: List[Dict] = []
    failed: List[Dict] = []

    # PDF 파일 목록 수집 및 분류
    question_files: List[Tuple[Dict, Path]] = []
    answer_files: List[Tuple[Dict, Path]] = []

    for pdf_file in sorted(year_dir.glob("*.pdf")):
        info = classify_file(pdf_file.name)
        if info["role"] == "question":
            question_files.append((info, pdf_file))
        elif info["role"] == "answer":
            answer_files.append((info, pdf_file))
        else:
            failed.append({
                "reason": f"파일명 패턴 인식 불가: {pdf_file.name}",
                "page": None,
                "text": pdf_file.name,
            })

    # 정답 데이터 미리 파싱
    # 구조: {"1차": {"1교시": {num: ans}, "2교시": {num: ans}}, "2차": {"객관식": {...}, "주관식": {...}}}
    answer_map: Dict[str, Dict] = {"1차": {}, "2차": {}}

    for ans_info, ans_path in answer_files:
        try:
            pages = extract_text_from_pdf(ans_path)
            full_text = "\n".join(pages)
            exam_type = ans_info["exam_type"]
            kind = ans_info.get("answer_kind", "all")

            # 텍스트가 너무 짧으면 이미지 기반 PDF로 판단 (정답표가 이미지)
            if len(full_text.strip()) < 100:
                failed.append({
                    "reason": (
                        f"정답 파일이 이미지 기반입니다 ({ans_path.name}). "
                        "정답을 자동으로 읽을 수 없어 정답 없이 문제를 임포트합니다."
                    ),
                    "page": None,
                    "text": ans_path.name,
                })
                continue

            if exam_type == "1차":
                s1, s2 = split_answer_by_session(full_text)
                answer_map["1차"]["1교시"] = s1
                answer_map["1차"]["2교시"] = s2
            else:
                answer_map["2차"][kind] = parse_answer_text(full_text)

        except Exception as e:
            failed.append({
                "reason": f"정답 파일 파싱 실패: {ans_path.name} — {e}",
                "page": None,
                "text": str(ans_path.name),
            })

    # 문제 파일 파싱
    for q_info, q_path in question_files:
        try:
            pages = extract_text_from_pdf(q_path)
        except Exception as e:
            failed.append({
                "reason": f"PDF 열기 실패: {q_path.name} — {e}",
                "page": None,
                "text": str(q_path.name),
            })
            continue

        exam_type = q_info["exam_type"]
        session = q_info.get("session")

        # 정답 딕셔너리 선택
        if exam_type == "1차":
            answers_for_file = answer_map["1차"].get(session, {})
        else:
            # 2차는 객관식/주관식 합산
            obj = answer_map["2차"].get("객관식", {})
            subj = answer_map["2차"].get("주관식", {})
            answers_for_file = {**obj, **subj}

        # 페이지 목록 기준 과목 분리 (구형식·신형식 모두 지원)
        subject_segments = split_pages_by_subject(pages)

        # 이 PDF 파일에서 추출된 문제만 별도로 수집 (MD 저장용)
        file_questions: List[Dict] = []

        for subject_name, subject_text in subject_segments:
            q_list = split_into_questions(subject_text)

            if not q_list:
                # 문제가 하나도 없는 과목 세그먼트 — 실패 기록
                failed.append({
                    "reason": f"문제 번호 파싱 실패: {q_path.name} / {subject_name}",
                    "page": None,
                    "text": subject_text[:200],
                })
                continue

            for q_num, q_text_raw in q_list:
                try:
                    options = extract_options(q_text_raw)
                    q_type = get_question_type(options)
                    clean_text = clean_question_text(q_text_raw, options)

                    # 정답 매칭 (정답 맵이 비어있으면 이미지 기반 PDF이므로 오류 기록 생략)
                    answer = answers_for_file.get(q_num)
                    if answer is None and answers_for_file:
                        failed.append({
                            "reason": f"정답 미매칭: {q_path.name} / {subject_name} / 문제{q_num}",
                            "page": None,
                            "text": clean_text[:100],
                        })

                    q_dict = {
                        "year": year,
                        "exam_type": exam_type,
                        "session": session,
                        "subject": subject_name,
                        "question_type": q_type,
                        "question_number": q_num,
                        "question_text": clean_text,
                        "options": json.dumps(options, ensure_ascii=False) if options else None,
                        "answer": answer,
                        "unit": "미분류",
                    }
                    questions.append(q_dict)
                    file_questions.append(q_dict)

                except Exception as e:
                    failed.append({
                        "reason": f"문제 파싱 오류: {q_path.name} / 문제{q_num} — {e}",
                        "page": None,
                        "text": q_text_raw[:100],
                    })

        # PDF와 같은 이름의 .md 파일로 추출 결과 저장
        try:
            save_questions_as_markdown(file_questions, q_path)
        except Exception:
            pass  # MD 저장 실패가 임포트 전체를 중단시키지 않도록

    return {"questions": questions, "failed": failed}


def save_questions_as_markdown(questions: List[Dict], pdf_path: Path) -> None:
    """
    파싱된 문제 목록을 원본 PDF와 같은 이름의 .md 파일로 저장.
    사용자가 추출 결과를 검토·수정할 수 있도록 사람이 읽기 쉬운 형식으로 작성.
    """
    if not questions:
        return

    md_path = pdf_path.with_suffix(".md")
    q = questions[0]
    year = q["year"]
    exam_type = q["exam_type"]
    session = q.get("session") or ""
    title_parts = [f"{year}년", exam_type]
    if session:
        title_parts.append(session)
    title_parts.append("문제")

    lines: List[str] = [
        f"# {'  '.join(title_parts)}",
        "",
        f"> 파싱일시: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "> 이 파일을 수정한 뒤 재임포트하면 수정된 내용이 반영됩니다.",
        "",
    ]

    # 과목별로 그룹화
    from collections import defaultdict
    by_subject: Dict[str, List[Dict]] = defaultdict(list)
    for item in questions:
        by_subject[item["subject"]].append(item)

    for subject, items in by_subject.items():
        lines.append(f"## {subject}")
        lines.append("")

        for item in sorted(items, key=lambda x: x["question_number"]):
            lines.append(f"### 문 {item['question_number']}.")
            lines.append("")
            lines.append(item["question_text"])
            lines.append("")

            options_raw = item.get("options")
            if options_raw:
                opts = json.loads(options_raw) if isinstance(options_raw, str) else options_raw
                circled = "①②③④⑤"
                for i, opt in enumerate(opts):
                    marker = circled[i] if i < len(circled) else f"{i+1}."
                    lines.append(f"{marker} {opt}")
                lines.append("")

            answer = item.get("answer") or "—"
            lines.append(f"**정답:** {answer}")
            lines.append(f"**단원:** {item.get('unit', '미분류')}")
            lines.append("")
            lines.append("---")
            lines.append("")

    md_path.write_text("\n".join(lines), encoding="utf-8")


def get_available_years() -> List[str]:
    """data/exams/ 아래 연도 폴더 목록 반환 (숫자 폴더만)."""
    if not EXAMS_DIR.exists():
        return []
    years = [
        d.name
        for d in sorted(EXAMS_DIR.iterdir())
        if d.is_dir() and d.name.isdigit()
    ]
    return years
