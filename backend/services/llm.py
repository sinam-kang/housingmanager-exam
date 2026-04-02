"""LLM 호출 서비스 — Claude Agent SDK를 통한 단원 태깅 및 해설 생성.

Claude Code CLI 로그인 세션을 사용하므로 별도 API 키 불필요.
"""
from __future__ import annotations

from typing import Dict, List, Optional


async def _ask_claude(prompt: str, timeout: float = 30.0) -> str:
    """Claude Agent SDK로 단순 텍스트 응답 요청. 도구 없이 순수 텍스트 생성."""
    import asyncio
    from claude_agent_sdk import query, ClaudeAgentOptions

    async def _query():
        result = ""
        async for message in query(
            prompt=prompt,
            options=ClaudeAgentOptions(allowed_tools=[]),
        ):
            if hasattr(message, "result"):
                result = message.result or ""
        return result.strip()

    return await asyncio.wait_for(_query(), timeout=timeout)


async def tag_unit(subject: str, question_text: str) -> str:
    """
    문제 하나에 대해 단원명 태깅.
    실패 시 "미분류" 반환 (예외 발생 금지).
    """
    prompt = (
        f"다음은 주택관리사 시험의 {subject} 과목 문제입니다.\n"
        "이 문제가 속하는 단원명을 한국어로 짧게 답하세요. "
        "(예: \"임대차\", \"소유권\", \"회계처리\" 등)\n"
        f"문제: {question_text}\n"
        "단원명만 답하세요."
    )
    try:
        result = await _ask_claude(prompt)
        # 줄바꿈/따옴표 제거
        unit = result.strip('"\'「」').split("\n")[0].strip()
        return unit if unit else "미분류"
    except Exception:
        return "미분류"


async def generate_explanation(
    subject: str,
    question_text: str,
    options: Optional[List[str]],
    answer: str,
    question_type: str,
) -> str:
    """
    오답 해설 생성. 실패 시 예외를 던진다 (호출자가 처리).
    """
    options_text = ""
    if question_type == "객관식" and options:
        numbered = ["①", "②", "③", "④", "⑤"]
        options_text = "\n" + "\n".join(
            f"{numbered[i] if i < len(numbered) else str(i + 1)} {opt}"
            for i, opt in enumerate(options)
        )

    prompt = (
        f"다음은 주택관리사 시험 {subject} 문제입니다.\n\n"
        f"문제: {question_text}"
        f"{options_text}\n"
        f"정답: {answer}\n\n"
        "이 문제의 정답 이유를 설명하고, 객관식인 경우 각 오답 보기가 왜 틀렸는지도 설명해주세요.\n"
        "수험생이 이해하기 쉽게 한국어로 작성해주세요."
    )

    result = await _ask_claude(prompt)
    if not result:
        raise RuntimeError("해설 생성에 실패했습니다. 잠시 후 다시 시도해주세요.")
    return result


async def tag_units_batch(items: List[Dict]) -> List[str]:
    """
    문제 목록에 대해 순서대로 단원명 태깅.
    items: [{"subject": "...", "question_text": "..."}, ...]
    반환: 단원명 리스트 (같은 순서)
    """
    results = []
    for item in items:
        unit = await tag_unit(
            subject=item.get("subject", ""),
            question_text=item.get("question_text", ""),
        )
        results.append(unit)
    return results


async def tag_units_stream(items: List[Dict]):
    """
    단원 태깅 결과를 하나씩 스트리밍.
    (index, unit) 튜플을 yield — SSE 프로그래스 바 용.
    """
    for i, item in enumerate(items):
        unit = await tag_unit(
            subject=item.get("subject", ""),
            question_text=item.get("question_text", ""),
        )
        yield i, unit
