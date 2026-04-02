"use client";

/**
 * 공통 북마크 버튼 컴포넌트.
 * 클릭 시 태그 선택 팝업 표시.
 */

import { useRef, useState } from "react";
import { addBookmark, deleteBookmark } from "../lib/api";

const TAG_COLORS: Record<string, string> = {
  중요: "text-red-500 border-red-300",
  어려움: "text-orange-400 border-orange-300",
  나중에: "text-blue-400 border-blue-300",
};

const TAG_BG: Record<string, string> = {
  중요: "hover:bg-red-50",
  어려움: "hover:bg-orange-50",
  나중에: "hover:bg-blue-50",
};

interface BookmarkButtonProps {
  questionId: number;
  currentTag: string | null;
  onChanged?: (tag: string | null) => void;
}

export default function BookmarkButton({ questionId, currentTag, onChanged }: BookmarkButtonProps) {
  const [tag, setTag] = useState<string | null>(currentTag);
  const [showPopup, setShowPopup] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleSelect = async (selected: string | null) => {
    setShowPopup(false);
    setLoading(true);
    try {
      if (selected === null) {
        await deleteBookmark(questionId);
        setTag(null);
        onChanged?.(null);
      } else {
        await addBookmark(questionId, selected);
        setTag(selected);
        onChanged?.(selected);
      }
    } catch {
      // 실패 시 무시 (UI 상태 복원 없음 — 새로고침 시 복원됨)
    } finally {
      setLoading(false);
    }
  };

  const colorClass = tag ? TAG_COLORS[tag] ?? "text-gray-500 border-gray-300" : "text-gray-500 border-gray-300";

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setShowPopup((v) => !v)}
        disabled={loading}
        className={`px-3 py-1.5 border text-sm rounded ${colorClass} ${
          loading ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
        }`}
      >
        {loading ? "처리 중..." : tag ? `★ ${tag}` : "☆ 북마크"}
      </button>

      {showPopup && (
        <div className="absolute left-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden min-w-[120px]">
          {["중요", "어려움", "나중에"].map((t) => (
            <button
              key={t}
              onClick={() => handleSelect(t)}
              className={`w-full text-left px-4 py-2 text-sm ${TAG_COLORS[t]} ${TAG_BG[t]}`}
            >
              ★ {t}
            </button>
          ))}
          {tag && (
            <button
              onClick={() => handleSelect(null)}
              className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 border-t border-gray-100"
            >
              ☆ 해제
            </button>
          )}
        </div>
      )}
    </div>
  );
}
