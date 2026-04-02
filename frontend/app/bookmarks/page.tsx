"use client";

/**
 * 북마크 목록 화면.
 * 태그별 탭 + 키워드 검색 지원.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchBookmarks, type BookmarkItem } from "../../lib/api";

const TAGS = ["전체", "중요", "어려움", "나중에"] as const;
type TagFilter = (typeof TAGS)[number];

const TAG_COLORS: Record<string, string> = {
  중요: "text-red-500 bg-red-50 border-red-200",
  어려움: "text-orange-400 bg-orange-50 border-orange-200",
  나중에: "text-blue-400 bg-blue-50 border-blue-200",
};

export default function BookmarksPage() {
  const router = useRouter();
  const [activeTag, setActiveTag] = useState<TagFilter>("전체");
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const tagParam = activeTag === "전체" ? undefined : activeTag;
    fetchBookmarks(tagParam, page, PAGE_SIZE)
      .then((res) => {
        // 키워드 클라이언트 필터링
        const filtered = keyword
          ? res.items.filter(
              (item) =>
                item.question_text.includes(keyword) ||
                item.subject.includes(keyword) ||
                (item.unit ?? "").includes(keyword)
            )
          : res.items;
        setItems(filtered);
        setTotal(keyword ? filtered.length : res.total);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "알 수 없는 오류";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [activeTag, page, keyword]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTagChange = (tag: TagFilter) => {
    setActiveTag(tag);
    setPage(1);
  };

  const handleKeyword = (value: string) => {
    setKeyword(value);
    setPage(1);
  };

  const handleStartQuiz = () => {
    const tagParam = activeTag === "전체" ? "" : `&bookmark_tag=${encodeURIComponent(activeTag)}`;
    router.push(`/quiz?bookmarked=true${tagParam}`);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">북마크</h1>
        <p className="text-sm text-gray-500">중요하거나 어려운 문제를 태그로 관리하세요.</p>
      </div>

      {/* 태그 탭 */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => handleTagChange(tag)}
            className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${
              activeTag === tag
                ? "border-gray-900 text-gray-900 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* "이 목록으로 퀴즈 시작" 버튼 */}
      <div className="flex items-center justify-between gap-3">
        {/* 키워드 검색 */}
        <input
          type="text"
          value={keyword}
          onChange={(e) => handleKeyword(e.target.value)}
          placeholder="키워드 검색..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-500"
        />
        <button
          onClick={handleStartQuiz}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 whitespace-nowrap"
        >
          이 목록으로 퀴즈 시작
        </button>
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

      {/* 빈 목록 */}
      {!loading && !error && items.length === 0 && (
        <div className="py-16 text-center text-gray-400">
          <p className="text-lg mb-1">북마크한 문제가 없습니다.</p>
          <p className="text-sm">문제 조회나 퀴즈 중에 북마크를 추가해 보세요.</p>
        </div>
      )}

      {/* 목록 */}
      {!loading && !error && items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <Link
              key={item.question_id}
              href={`/questions/${item.question_id}`}
              className="block bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-400 hover:shadow-sm transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* 태그 뱃지 */}
                <span
                  className={`mt-0.5 px-2 py-0.5 border rounded text-xs font-medium shrink-0 ${
                    TAG_COLORS[item.tag] ?? "text-gray-500 bg-gray-50 border-gray-200"
                  }`}
                >
                  {item.tag}
                </span>

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

                  {/* 오답 이력 */}
                  {item.has_wrong && (
                    <span className="inline-flex items-center gap-1 mt-1 text-xs text-red-500">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block" />
                      오답 이력 있음
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
