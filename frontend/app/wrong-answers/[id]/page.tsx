"use client";

/**
 * 오답 상세 화면.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchWrongAnswer,
  deleteWrongAnswer,
  generateExplanation,
  type WrongAnswerDetail,
} from "../../../lib/api";
import BookmarkButton from "../../../components/BookmarkButton";

const CIRCLE_NUMBERS = ["①", "②", "③", "④", "⑤"];

export default function WrongAnswerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const questionId = Number(params.id);

  const [detail, setDetail] = useState<WrongAnswerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [explanation, setExplanation] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [generatingExplanation, setGeneratingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState("");

  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isNaN(questionId)) {
      fetchWrongAnswer(questionId)
        .then((data) => {
          setDetail(data);
          if (data.explanation) {
            setExplanation(data.explanation);
          }
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "알 수 없는 오류";
          setError(msg);
        })
        .finally(() => setLoading(false));
    }
  }, [questionId]);

  const handleExplanation = async () => {
    if (explanation) {
      setShowExplanation((v) => !v);
      return;
    }
    setShowExplanation(true);
    setGeneratingExplanation(true);
    setExplanationError("");
    try {
      const res = await generateExplanation(questionId);
      setExplanation(res.explanation);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      setExplanationError(msg);
    } finally {
      setGeneratingExplanation(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("오답노트에서 제거하시겠습니까?")) return;
    setDeleting(true);
    try {
      await deleteWrongAnswer(questionId);
      router.push("/wrong-answers");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      alert(`제거 실패: ${msg}`);
      setDeleting(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-gray-400 animate-pulse">
        불러오는 중...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/wrong-answers" className="text-sm text-gray-500 hover:text-gray-900">
          ← 오답노트 목록
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <p className="font-semibold mb-1">불러올 수 없습니다.</p>
          <p>{error || "데이터가 없습니다."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 뒤로가기 */}
      <Link href="/wrong-answers" className="text-sm text-gray-500 hover:text-gray-900 w-fit">
        ← 오답노트 목록
      </Link>

      {/* 메타 정보 */}
      <div className="text-sm text-gray-500">
        {detail.year}년 {detail.exam_type}
        {detail.session && ` · ${detail.session}`}
        {` · ${detail.subject}`}
        {detail.unit && detail.unit !== "미분류" && ` · ${detail.unit}`}
      </div>

      {/* 문제 카드 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-5">
        {/* 틀린 횟수 / 날짜 */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-red-500 font-semibold">{detail.wrong_count}회 틀림</span>
          <span className="text-gray-400">마지막: {formatDate(detail.last_wrong_at)}</span>
        </div>

        {/* 문제 텍스트 */}
        <div>
          <p className="text-xs font-semibold text-gray-400 mb-2">
            {detail.question_number}번 · {detail.question_type}
          </p>
          <p className="text-base text-gray-900 leading-relaxed whitespace-pre-wrap">
            {detail.question_text}
          </p>
        </div>

        {/* 보기 (객관식) */}
        {detail.question_type === "객관식" && detail.options && detail.options.length > 0 && (
          <div className="flex flex-col gap-2">
            {detail.options.map((opt, idx) => {
              const isCorrect = detail.answer === String(idx + 1);
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2 text-sm px-3 py-2 rounded ${
                    isCorrect ? "bg-green-50 border border-green-200" : ""
                  }`}
                >
                  <span className="shrink-0 text-gray-500 font-medium w-5">
                    {CIRCLE_NUMBERS[idx] ?? `${idx + 1}.`}
                  </span>
                  <span className={`leading-relaxed ${isCorrect ? "text-green-800 font-medium" : "text-gray-800"}`}>
                    {opt}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* 정답 표시 */}
        <div className="px-4 py-3 bg-green-50 border border-green-200 rounded text-sm">
          <span className="font-semibold text-green-700">정답: </span>
          <span className="text-green-800">{detail.answer ?? "정답 정보 없음"}</span>
        </div>

        <div className="border-t border-gray-100" />

        {/* 액션 버튼들 */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* 북마크 버튼 */}
          <BookmarkButton
            questionId={questionId}
            currentTag={detail.bookmark_tag}
          />

          {/* 해설 보기 */}
          <button
            onClick={handleExplanation}
            disabled={generatingExplanation}
            className="px-4 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {generatingExplanation ? "해설 생성 중..." : explanation ? (showExplanation ? "해설 숨기기" : "해설 보기") : "해설 생성"}
          </button>

          {/* 오답노트에서 제거 */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-1.5 border border-red-200 text-sm text-red-500 rounded hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? "제거 중..." : "오답노트에서 제거"}
          </button>

          {/* 문제 상세 이동 */}
          <Link
            href={`/questions/${questionId}`}
            className="ml-auto px-4 py-1.5 border border-gray-300 text-sm text-gray-600 rounded hover:bg-gray-50"
          >
            문제 상세 보기
          </Link>
        </div>

        {/* 해설 */}
        {showExplanation && (
          <div>
            {generatingExplanation && (
              <div className="text-sm text-gray-400 animate-pulse">해설을 생성하고 있습니다...</div>
            )}
            {explanationError && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-600">
                <p className="font-semibold mb-1">해설 생성 실패</p>
                <p>{explanationError}</p>
                <button
                  onClick={handleExplanation}
                  className="mt-2 text-xs underline hover:no-underline"
                >
                  다시 시도
                </button>
              </div>
            )}
            {explanation && !generatingExplanation && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {explanation}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
