"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  fetchQuestions,
  fetchQuestionMeta,
  type QuestionSummary,
  type QuestionMeta,
} from "../../lib/api";
import FilterPanel, { type FilterState } from "../../components/FilterPanel";

// 북마크 태그별 색상
const BOOKMARK_TAG_COLOR: Record<string, string> = {
  중요: "text-red-500",
  어려움: "text-orange-400",
  나중에: "text-blue-400",
};

export default function QuestionsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [filterState, setFilterState] = useState<FilterState>({});
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [meta, setMeta] = useState<QuestionMeta>({ years: [], subjects: [], units: {} });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 메타데이터 로드
  useEffect(() => {
    fetchQuestionMeta()
      .then(setMeta)
      .catch(() => {});
  }, []);

  // 문제 목록 로드
  useEffect(() => {
    setLoading(true);
    setError("");
    fetchQuestions({
      q: searchInput || undefined,
      year: filterState.year,
      exam_type: filterState.exam_type,
      subject: filterState.subject,
      unit: filterState.unit,
      question_type: filterState.question_type,
      bookmarked: filterState.bookmarked,
      wrong_only: filterState.wrong_only,
      page,
      page_size: PAGE_SIZE,
    })
      .then((res) => {
        setQuestions(res.items);
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "알 수 없는 오류";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [filterState, page, searchInput]);

  // 검색창 디바운스 (0.5초)
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
    }, 500);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setPage(1);
    }
  };

  const handleFilterChange = (f: FilterState) => {
    setFilterState(f);
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">문제 조회</h1>
        <p className="text-sm text-gray-500">키워드 검색과 필터로 문제를 찾아보세요.</p>
      </div>

      {/* 검색창 */}
      <div className="relative">
        <input
          type="text"
          placeholder="문제 텍스트 키워드 검색 (엔터 또는 0.5초 후 자동 검색)"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
        />
      </div>

      {/* 필터 패널 */}
      <FilterPanel
        meta={meta}
        value={filterState}
        onChange={handleFilterChange}
      />

      {/* 결과 수 */}
      {!loading && !error && (
        <p className="text-sm text-gray-500">
          총 <span className="font-semibold text-gray-900">{total.toLocaleString()}</span>문제
        </p>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="py-12 text-center text-sm text-gray-400 animate-pulse">
          불러오는 중...
        </div>
      )}

      {/* 에러 */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <p className="font-semibold mb-1">오류 발생</p>
          <p>{error}</p>
        </div>
      )}

      {/* 빈 결과 */}
      {!loading && !error && questions.length === 0 && (
        <div className="py-16 text-center text-gray-400">
          <p className="text-lg mb-1">임포트된 문제가 없습니다.</p>
          <p className="text-sm">
            먼저{" "}
            <Link href="/import" className="underline hover:text-gray-600">
              PDF 임포트
            </Link>
            를 진행해주세요.
          </p>
        </div>
      )}

      {/* 문제 목록 */}
      {!loading && !error && questions.length > 0 && (
        <div className="flex flex-col gap-2">
          {questions.map((q) => (
            <Link
              key={q.id}
              href={`/questions/${q.id}`}
              className="block bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-400 hover:shadow-sm transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* 메타 정보 */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1 flex-wrap">
                    <span>{q.year}년</span>
                    <span>·</span>
                    <span>{q.exam_type}</span>
                    {q.session && (
                      <>
                        <span>·</span>
                        <span>{q.session}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{q.subject}</span>
                    {q.unit && (
                      <>
                        <span>·</span>
                        <span>{q.unit}</span>
                      </>
                    )}
                  </div>

                  {/* 문제번호 + 텍스트 */}
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-gray-500 shrink-0">
                      {q.question_number}번
                    </span>
                    <p className="text-sm text-gray-900 line-clamp-2">{q.question_text}</p>
                  </div>
                </div>

                {/* 아이콘 영역 */}
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  {q.has_wrong && (
                    <span className="w-2 h-2 bg-red-500 rounded-full" title="오답 이력 있음" />
                  )}
                  {q.has_bookmark && q.bookmark_tag && (
                    <span
                      className={`text-sm ${BOOKMARK_TAG_COLOR[q.bookmark_tag] ?? "text-gray-400"}`}
                      title={`북마크: ${q.bookmark_tag}`}
                    >
                      ★
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            이전
          </button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
