"use client";

/**
 * 오답노트 목록 화면.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchWrongAnswers, type WrongAnswerItem } from "../../lib/api";

const BOOKMARK_TAG_COLOR: Record<string, string> = {
  중요: "text-red-500",
  어려움: "text-orange-400",
  나중에: "text-blue-400",
};

type SortType = "recent" | "count" | "subject";

const SORT_LABELS: Record<SortType, string> = {
  recent: "최근 틀린 순",
  count: "틀린 횟수 순",
  subject: "과목별",
};

export default function WrongAnswersPage() {
  const [sort, setSort] = useState<SortType>("recent");
  const [items, setItems] = useState<WrongAnswerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetchWrongAnswers(sort, page, PAGE_SIZE)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "알 수 없는 오류";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [sort, page]);

  const handleSortChange = (s: SortType) => {
    setSort(s);
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">오답노트</h1>
        <p className="text-sm text-gray-500">틀린 문제를 정리하고 복습하세요.</p>
      </div>

      {/* 정렬 탭 */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {(Object.keys(SORT_LABELS) as SortType[]).map((s) => (
          <button
            key={s}
            onClick={() => handleSortChange(s)}
            className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${
              sort === s
                ? "border-gray-900 text-gray-900 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {SORT_LABELS[s]}
          </button>
        ))}
      </div>

      {/* 결과 수 */}
      {!loading && !error && (
        <p className="text-sm text-gray-500">
          총 <span className="font-semibold text-gray-900">{total.toLocaleString()}</span>개
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
      {!loading && !error && items.length === 0 && (
        <div className="py-16 text-center text-gray-400">
          <p className="text-lg mb-1">오답 이력이 없습니다.</p>
          <p className="text-sm">
            퀴즈를 풀면 틀린 문제가 자동으로 저장됩니다.
          </p>
        </div>
      )}

      {/* 목록 */}
      {!loading && !error && items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <Link
              key={item.question_id}
              href={`/wrong-answers/${item.question_id}`}
              className="block bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-400 hover:shadow-sm transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* 메타 정보 */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1 flex-wrap">
                    <span>{item.year}년</span>
                    <span>·</span>
                    <span>{item.exam_type}</span>
                    <span>·</span>
                    <span>{item.subject}</span>
                    {item.unit && (
                      <>
                        <span>·</span>
                        <span>{item.unit}</span>
                      </>
                    )}
                  </div>

                  {/* 문제번호 + 텍스트 */}
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-gray-500 shrink-0">
                      {item.question_number}번
                    </span>
                    <p className="text-sm text-gray-900 line-clamp-2">{item.question_text}</p>
                  </div>
                </div>

                {/* 아이콘/정보 */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs font-semibold text-red-500">{item.wrong_count}회 틀림</span>
                  <span className="text-xs text-gray-400">{formatDate(item.last_wrong_at)}</span>
                  <div className="flex items-center gap-1.5">
                    {item.has_explanation && (
                      <span className="text-xs text-blue-400" title="해설 있음">해설✓</span>
                    )}
                    {item.has_bookmark && item.bookmark_tag && (
                      <span
                        className={`text-sm ${BOOKMARK_TAG_COLOR[item.bookmark_tag] ?? "text-gray-400"}`}
                        title={`북마크: ${item.bookmark_tag}`}
                      >
                        ★
                      </span>
                    )}
                  </div>
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
          <span className="text-sm text-gray-600">{page} / {totalPages}</span>
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
