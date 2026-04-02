"use client";

/**
 * 공통 필터 컴포넌트.
 * 문제 목록, 퀴즈 시작, 오답노트, 북마크 페이지에서 재사용.
 */

import { useState } from "react";
import type { QuestionMeta } from "../lib/api";

export interface FilterState {
  year?: number;
  exam_type?: string;   // "1차" | "2차"
  subject?: string;
  unit?: string;
  question_type?: string;  // "객관식" | "주관식"
  bookmarked?: boolean;
  wrong_only?: boolean;
}

interface FilterPanelProps {
  meta: QuestionMeta;
  value: FilterState;
  onChange: (f: FilterState) => void;
}

export default function FilterPanel({ meta, value, onChange }: FilterPanelProps) {
  const [open, setOpen] = useState(false);

  // 과목 선택 시 해당 과목의 단원 목록만 표시 (계층형)
  const unitDisabled = !value.subject;
  const availableUnits: string[] = value.subject
    ? (meta.units[value.subject] ?? [])
    : [];

  // 적용된 필터 수 계산
  const activeCount = [
    value.year,
    value.exam_type,
    value.subject,
    value.unit,
    value.question_type,
    value.bookmarked,
    value.wrong_only,
  ].filter(Boolean).length;

  const handleChange = (patch: Partial<FilterState>) => {
    const next = { ...value, ...patch };
    // 과목 변경 시 단원 초기화
    if ("subject" in patch && patch.subject !== value.subject) {
      next.unit = undefined;
    }
    onChange(next);
  };

  const handleReset = () => {
    onChange({});
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* 토글 헤더 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
      >
        <span className="flex items-center gap-2">
          필터
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs text-white bg-gray-700 rounded-full">
              {activeCount}
            </span>
          )}
        </span>
        <span className="text-gray-400 text-xs">{open ? "▲ 접기" : "▼ 펼치기"}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* 연도 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">연도</label>
              <select
                value={value.year ?? ""}
                onChange={(e) =>
                  handleChange({ year: e.target.value ? Number(e.target.value) : undefined })
                }
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                <option value="">전체</option>
                {meta.years.map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
            </div>

            {/* 시험차수 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">시험차수</label>
              <select
                value={value.exam_type ?? ""}
                onChange={(e) =>
                  handleChange({ exam_type: e.target.value || undefined })
                }
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                <option value="">전체</option>
                <option value="1차">1차</option>
                <option value="2차">2차</option>
              </select>
            </div>

            {/* 문제유형 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">문제유형</label>
              <select
                value={value.question_type ?? ""}
                onChange={(e) =>
                  handleChange({ question_type: e.target.value || undefined })
                }
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                <option value="">전체</option>
                <option value="객관식">객관식</option>
                <option value="주관식">주관식</option>
              </select>
            </div>

            {/* 과목 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">과목</label>
              <select
                value={value.subject ?? ""}
                onChange={(e) =>
                  handleChange({ subject: e.target.value || undefined })
                }
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                <option value="">전체</option>
                {meta.subjects.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* 단원 — 과목 선택 후 활성화 (계층형: 선택 과목의 단원만 표시) */}
            <div className="flex flex-col gap-1">
              <label className={`text-xs ${unitDisabled ? "text-gray-300" : "text-gray-500"}`}>
                단원
              </label>
              <select
                value={value.unit ?? ""}
                disabled={unitDisabled}
                onChange={(e) =>
                  handleChange({ unit: e.target.value || undefined })
                }
                className={`border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 ${
                  unitDisabled
                    ? "border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed"
                    : "border-gray-300"
                }`}
              >
                <option value="">전체</option>
                {!unitDisabled &&
                  availableUnits.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
              </select>
            </div>
          </div>

          {/* 토글 체크박스 */}
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={value.bookmarked ?? false}
                onChange={(e) =>
                  handleChange({ bookmarked: e.target.checked || undefined })
                }
                className="w-4 h-4 accent-gray-700"
              />
              북마크한 문제만
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={value.wrong_only ?? false}
                onChange={(e) =>
                  handleChange({ wrong_only: e.target.checked || undefined })
                }
                className="w-4 h-4 accent-gray-700"
              />
              오답 이력 있는 문제만
            </label>
          </div>

          {/* 초기화 버튼 */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50"
            >
              필터 초기화
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
