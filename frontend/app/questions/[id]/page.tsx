"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchQuestion, type QuestionDetail } from "../../../lib/api";
import BookmarkButton from "../../../components/BookmarkButton";

// 객관식 보기 번호 표시 (①②③④⑤)
const CIRCLE_NUMBERS = ["①", "②", "③", "④", "⑤"];

export default function QuestionDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // 북마크 태그 (BookmarkButton 콜백으로 업데이트)
  const [bookmarkTag, setBookmarkTag] = useState<string | null>(null);

  // 정답 토글
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    if (!id || isNaN(id)) {
      setError("잘못된 문제 번호입니다.");
      setLoading(false);
      return;
    }

    fetchQuestion(id)
      .then((data) => {
        setQuestion(data);
        setBookmarkTag(data.bookmark_tag);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "알 수 없는 오류";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-gray-400 animate-pulse">
        불러오는 중...
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/questions" className="text-sm text-gray-500 hover:text-gray-900">
          ← 목록으로
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <p className="font-semibold mb-1">문제를 불러올 수 없습니다.</p>
          <p>{error || "문제 데이터가 없습니다."}</p>
        </div>
      </div>
    );
  }

  const metaParts = [
    `${question.year}년 ${question.exam_type}`,
    question.session ?? null,
    question.subject,
    question.unit && question.unit !== "미분류" ? question.unit : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      {/* 뒤로가기 */}
      <Link href="/questions" className="text-sm text-gray-500 hover:text-gray-900 w-fit">
        ← 목록으로
      </Link>

      {/* 메타 정보 */}
      <div className="text-sm text-gray-500">
        {metaParts.join(" | ")}
      </div>

      {/* 문제 카드 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-5">
        {/* 문제 번호 + 텍스트 */}
        <div>
          <p className="text-xs font-semibold text-gray-400 mb-2">
            {question.question_number}번 · {question.question_type}
          </p>
          <p className="text-base text-gray-900 leading-relaxed whitespace-pre-wrap">
            {question.question_text}
          </p>
        </div>

        {/* 보기 (객관식만) */}
        {question.question_type === "객관식" && question.options && question.options.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            {question.options.map((opt, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-gray-800">
                <span className="shrink-0 text-gray-500 font-medium w-5">
                  {CIRCLE_NUMBERS[idx] ?? `${idx + 1}.`}
                </span>
                <span className="leading-relaxed">{opt}</span>
              </div>
            ))}
          </div>
        )}

        {/* 정답 토글 */}
        <div className="pt-1">
          <button
            onClick={() => setShowAnswer((v) => !v)}
            className="px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50"
          >
            {showAnswer ? "정답 숨기기" : "정답 보기"}
          </button>

          {showAnswer && (
            <div className="mt-3 px-4 py-3 bg-green-50 border border-green-200 rounded text-sm">
              <span className="font-semibold text-green-700">정답: </span>
              <span className="text-green-800">
                {question.answer ?? "정답 정보 없음"}
              </span>
            </div>
          )}
        </div>

        {/* 구분선 */}
        <div className="border-t border-gray-100" />

        {/* 액션 버튼 영역 */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* 북마크 버튼 */}
          <BookmarkButton
            questionId={question.id}
            currentTag={bookmarkTag}
            onChanged={setBookmarkTag}
          />

          {/* 오답 이력 */}
          {question.has_wrong && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <span className="w-2 h-2 bg-red-500 rounded-full inline-block" />
              오답 이력 {question.wrong_count}회
            </span>
          )}

          {/* 퀴즈 시작 버튼 */}
          <Link
            href={`/quiz?start=${question.id}`}
            className="ml-auto px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
          >
            이 문제부터 퀴즈 시작
          </Link>
        </div>
      </div>
    </div>
  );
}
