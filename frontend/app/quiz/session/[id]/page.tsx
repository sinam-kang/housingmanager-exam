"use client";

/**
 * 퀴즈 진행 화면.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  fetchQuizQuestion,
  submitQuizAnswer,
  type QuizQuestion,
  type SubmitAnswerResponse,
} from "../../../../lib/api";

const CIRCLE_NUMBERS = ["①", "②", "③", "④", "⑤"];

export default function QuizSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = Number(params.id);

  const [index, setIndex] = useState(0);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 답안 상태
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitAnswerResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 주관식: 정답 공개 후 맞음/틀림 선택
  const [shortAnswerRevealed, setShortAnswerRevealed] = useState(false);

  const loadQuestion = (idx: number) => {
    setLoading(true);
    setError("");
    setSelectedAnswer(null);
    setResult(null);
    setShortAnswerRevealed(false);
    fetchQuizQuestion(sessionId, idx)
      .then(setQuestion)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "알 수 없는 오류";
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isNaN(sessionId)) {
      loadQuestion(index);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, index]);

  const handleSelectOption = (answer: string) => {
    if (result) return; // 이미 제출됨
    setSelectedAnswer(answer);
  };

  const handleSubmit = async (answer: string) => {
    if (!question || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitQuizAnswer(sessionId, {
        question_id: question.id,
        user_answer: answer,
        index: question.index,
      });
      setResult(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!result) return;
    if (result.is_last) {
      router.push(`/quiz/session/${sessionId}/result`);
    } else {
      setIndex((i) => i + 1);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-gray-400 animate-pulse">
        문제 불러오는 중...
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <p className="font-semibold mb-1">오류 발생</p>
          <p>{error || "문제를 불러올 수 없습니다."}</p>
        </div>
      </div>
    );
  }

  const isMultipleChoice = question.question_type === "객관식";

  return (
    <div className="flex flex-col gap-6">
      {/* 진행 상황 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{question.index + 1}</span>
          {" / "}
          {question.total}
        </span>
        <span className="text-xs text-gray-400">{question.year}년 {question.exam_type} · {question.subject}</span>
      </div>

      {/* 진행 바 */}
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className="bg-gray-700 h-1.5 rounded-full transition-all"
          style={{ width: `${((question.index + 1) / question.total) * 100}%` }}
        />
      </div>

      {/* 문제 카드 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-5">
        {/* 문제 텍스트 */}
        <div>
          <p className="text-xs font-semibold text-gray-400 mb-2">
            {question.question_number}번 · {question.question_type}
          </p>
          <p className="text-base text-gray-900 leading-relaxed whitespace-pre-wrap">
            {question.question_text}
          </p>
        </div>

        {/* 객관식 보기 */}
        {isMultipleChoice && question.options && (
          <div className="flex flex-col gap-2">
            {question.options.map((opt, idx) => {
              const answer = String(idx + 1);
              const isSelected = selectedAnswer === answer;
              const isCorrect = result?.correct_answer === answer;
              const isWrong = result && isSelected && !result.is_correct;

              let borderClass = "border-gray-200 hover:border-gray-400";
              let bgClass = "";
              if (result) {
                if (isCorrect) {
                  borderClass = "border-green-400";
                  bgClass = "bg-green-50";
                } else if (isWrong) {
                  borderClass = "border-red-400";
                  bgClass = "bg-red-50";
                }
              } else if (isSelected) {
                borderClass = "border-gray-700";
                bgClass = "bg-gray-50";
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(answer)}
                  disabled={!!result}
                  className={`flex items-start gap-3 px-4 py-3 border rounded-lg text-sm text-left transition-colors ${borderClass} ${bgClass} disabled:cursor-default`}
                >
                  <span className="shrink-0 font-medium text-gray-500 w-5 pt-0.5">
                    {CIRCLE_NUMBERS[idx] ?? `${idx + 1}.`}
                  </span>
                  <span className="text-gray-800 leading-relaxed">{opt}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 주관식 */}
        {!isMultipleChoice && (
          <div className="flex flex-col gap-3">
            {!shortAnswerRevealed && !result && (
              <button
                onClick={() => setShortAnswerRevealed(true)}
                className="self-start px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50"
              >
                정답 공개
              </button>
            )}
            {shortAnswerRevealed && !result && (
              <div className="flex flex-col gap-3">
                <div className="px-4 py-3 bg-green-50 border border-green-200 rounded text-sm">
                  <span className="font-semibold text-green-700">정답: </span>
                  <span className="text-green-800">{question.answer ?? "정답 정보 없음"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleSubmit("맞음")}
                    disabled={submitting}
                    className="px-5 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    맞음
                  </button>
                  <button
                    onClick={() => handleSubmit("틀림")}
                    disabled={submitting}
                    className="px-5 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 disabled:opacity-50"
                  >
                    틀림
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 피드백 */}
        {result && (
          <div
            className={`px-4 py-3 rounded-lg text-sm font-semibold ${
              result.is_correct
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-600"
            }`}
          >
            {result.is_correct ? "정답입니다!" : `틀렸습니다. 정답: ${result.correct_answer}`}
          </div>
        )}

        {/* 객관식 제출 버튼 */}
        {isMultipleChoice && !result && selectedAnswer && (
          <button
            onClick={() => handleSubmit(selectedAnswer)}
            disabled={submitting}
            className="self-start px-5 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
          >
            {submitting ? "제출 중..." : "제출"}
          </button>
        )}

        {/* 다음 버튼 */}
        {result && (
          <button
            onClick={handleNext}
            className="self-start px-5 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
          >
            {result.is_last ? "결과 보기" : "다음 문제"}
          </button>
        )}
      </div>
    </div>
  );
}
