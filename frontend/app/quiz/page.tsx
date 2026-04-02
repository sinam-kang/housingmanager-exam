"use client";

/**
 * 퀴즈 시작 설정 화면.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchQuestionMeta, startQuiz, type QuestionMeta } from "../../lib/api";
import FilterPanel, { type FilterState } from "../../components/FilterPanel";

export default function QuizPage() {
  const router = useRouter();

  const [meta, setMeta] = useState<QuestionMeta>({ years: [], subjects: [], units: {} });
  const [filterState, setFilterState] = useState<FilterState>({});
  const [mode, setMode] = useState<"ordered" | "random">("ordered");
  const [limit, setLimit] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchQuestionMeta()
      .then(setMeta)
      .catch(() => {});
  }, []);

  const handleStart = async () => {
    setStarting(true);
    setError("");
    try {
      const limitNum = limit ? Number(limit) : undefined;
      const res = await startQuiz({
        filter: Object.keys(filterState).length > 0 ? filterState : undefined,
        mode,
        limit: limitNum,
      });
      router.push(`/quiz/session/${res.session_id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      setError(msg);
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">퀴즈 시작</h1>
        <p className="text-sm text-gray-500">범위와 방식을 선택하고 퀴즈를 시작하세요.</p>
      </div>

      {/* 범위 선택 */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-gray-700">범위 선택</h2>
        <FilterPanel meta={meta} value={filterState} onChange={setFilterState} />
      </div>

      {/* 출제 방식 */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-gray-700">출제 방식</h2>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="ordered"
              checked={mode === "ordered"}
              onChange={() => setMode("ordered")}
              className="accent-gray-700"
            />
            순서대로
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="random"
              checked={mode === "random"}
              onChange={() => setMode("random")}
              className="accent-gray-700"
            />
            랜덤 셔플
          </label>
        </div>

        {/* 문제 수 제한 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">최대 문제 수 (비워두면 전체)</label>
          <input
            type="number"
            min={1}
            placeholder="예: 20"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <p className="font-semibold mb-1">시작할 수 없습니다.</p>
          <p>{error}</p>
        </div>
      )}

      {/* 시작 버튼 */}
      <button
        onClick={handleStart}
        disabled={starting}
        className="px-6 py-3 bg-gray-900 text-white text-sm font-semibold rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed self-start"
      >
        {starting ? "퀴즈 준비 중..." : "퀴즈 시작"}
      </button>
    </div>
  );
}
