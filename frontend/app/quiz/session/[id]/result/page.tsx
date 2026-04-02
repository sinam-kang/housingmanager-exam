"use client";

/**
 * 퀴즈 결과 화면.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchQuizResult, type QuizResultResponse } from "../../../../../lib/api";

export default function QuizResultPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = Number(params.id);

  const [result, setResult] = useState<QuizResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNaN(sessionId)) {
      fetchQuizResult(sessionId)
        .then(setResult)
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "알 수 없는 오류";
          setError(msg);
        })
        .finally(() => setLoading(false));
    }
  }, [sessionId]);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-gray-400 animate-pulse">
        결과 불러오는 중...
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <p className="font-semibold mb-1">결과를 불러올 수 없습니다.</p>
          <p>{error}</p>
        </div>
        <Link href="/quiz" className="text-sm text-gray-500 hover:text-gray-900">
          ← 퀴즈 설정으로
        </Link>
      </div>
    );
  }

  const ratePercent = Math.round(result.rate * 100);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-gray-900">퀴즈 결과</h1>

      {/* 점수 카드 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-center mb-5">
          <div>
            <p className="text-xs text-gray-500 mb-1">총 문제</p>
            <p className="text-2xl font-semibold text-gray-900">{result.total}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">맞은 수</p>
            <p className="text-2xl font-semibold text-green-600">{result.correct}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">틀린 수</p>
            <p className="text-2xl font-semibold text-red-500">{result.wrong}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">정답률</p>
            <p className="text-2xl font-semibold text-gray-900">{ratePercent}%</p>
          </div>
        </div>

        {/* 정답률 바 */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full"
            style={{ width: `${ratePercent}%` }}
          />
        </div>
      </div>

      {/* 오답 문제 목록 */}
      {result.wrong_questions.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-700">
            오답 문제 ({result.wrong_questions.length}개)
          </h2>
          <div className="flex flex-col gap-2">
            {result.wrong_questions.map((q) => (
              <Link
                key={q.id}
                href={`/questions/${q.id}`}
                className="block bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-400 hover:shadow-sm transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold text-gray-400 shrink-0 pt-0.5">
                    {q.year}년 · {q.subject} · {q.question_number}번
                  </span>
                  <p className="text-sm text-gray-900 line-clamp-2">{q.question_text}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/quiz"
          className="px-5 py-2.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          다시 풀기
        </Link>
        <Link
          href="/"
          className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50"
        >
          홈으로
        </Link>
        {result.wrong_questions.length > 0 && (
          <Link
            href="/wrong-answers"
            className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50"
          >
            오답노트 보기
          </Link>
        )}
      </div>
    </div>
  );
}
