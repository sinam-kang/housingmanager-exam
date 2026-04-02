"use client";

import { useEffect, useRef, useState } from "react";
import { fetchImportYears, fetchImportStatus, type YearItem, type ImportStatus } from "../../lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Stage = "idle" | "parsing" | "saving" | "tagging" | "done" | "error";

interface TaggingProgress {
  current: number;
  total: number;
  unit: string;
  subject: string;
}

interface ImportResult {
  success: number;
  failed: number;
  failed_items: { reason: string; text?: string }[];
}

export default function ImportPage() {
  const [years, setYears] = useState<YearItem[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [statusMap, setStatusMap] = useState<Record<string, ImportStatus>>({});
  const [stage, setStage] = useState<Stage>("idle");
  const [tagging, setTagging] = useState<TaggingProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetchImportYears()
      .then(async (items) => {
        setYears(items);
        if (items.length > 0) {
          setSelectedYear(items[items.length - 1].year);
          const entries = await Promise.all(
            items.map(async (item) => {
              try {
                const s = await fetchImportStatus(item.year);
                return [item.year, s] as const;
              } catch {
                return [item.year, { year: item.year, imported: false, question_count: 0 }] as const;
              }
            })
          );
          setStatusMap(Object.fromEntries(entries));
        }
      })
      .catch(() => setErrorMsg("연도 목록을 불러오는 데 실패했습니다."));
  }, []);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setStage("idle");
    setResult(null);
    setTagging(null);
    setErrorMsg("");
    setShowOverwriteConfirm(false);
  };

  const startImport = (action?: "overwrite" | "skip") => {
    if (!selectedYear) return;
    setShowOverwriteConfirm(false);
    setErrorMsg("");
    setResult(null);
    setTagging(null);
    setStage("parsing");

    // 기존 SSE 연결 닫기
    esRef.current?.close();

    const params = new URLSearchParams({ year: selectedYear });
    if (action) params.set("action", action);

    const es = new EventSource(`${API_BASE}/api/import/run-stream?${params}`);
    esRef.current = es;

    es.addEventListener("progress", (e) => {
      const data = JSON.parse(e.data);

      if (data.stage === "parsing") {
        setStage("parsing");
      } else if (data.stage === "saving") {
        setStage("saving");
      } else if (data.stage === "tagging") {
        setStage("tagging");
        setTagging({
          current: data.current,
          total: data.total,
          unit: data.unit,
          subject: data.subject,
        });
      } else if (data.stage === "done") {
        setResult({ success: data.success, failed: data.failed, failed_items: data.failed_items ?? [] });
        setStage("done");
        es.close();
        // 완료 후 상태 갱신
        fetchImportStatus(selectedYear)
          .then((s) => setStatusMap((prev) => ({ ...prev, [selectedYear]: s })))
          .catch(() => {});
      } else if (data.stage === "error") {
        if (data.message === "duplicate") {
          setStage("idle");
          setShowOverwriteConfirm(true);
        } else {
          setErrorMsg(data.message ?? "알 수 없는 오류");
          setStage("error");
        }
        es.close();
      }
    });

    es.onerror = () => {
      setErrorMsg("서버 연결이 끊어졌습니다. 서버가 실행 중인지 확인해주세요.");
      setStage("error");
      es.close();
    };
  };

  const isRunning = stage === "parsing" || stage === "saving" || stage === "tagging";
  const selectedStatus = statusMap[selectedYear];
  const taggingPercent = tagging ? Math.round((tagging.current / tagging.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">PDF 임포트</h1>
        <p className="text-sm text-gray-500">data/exams/ 폴더의 기출문제 PDF를 임포트합니다.</p>
      </div>

      {/* 연도 선택 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-gray-900">1. 연도 선택</h2>
        {years.length === 0 ? (
          <p className="text-sm text-gray-400">data/exams/ 폴더에 연도 폴더(예: 2024/)가 없습니다.</p>
        ) : (
          <select
            className="w-fit border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            value={selectedYear}
            onChange={(e) => handleYearChange(e.target.value)}
            disabled={isRunning}
          >
            {years.map((item) => (
              <option key={item.year} value={item.year}>
                {item.year}년{statusMap[item.year]?.imported ? ` (임포트됨 — ${statusMap[item.year].question_count}문제)` : ""}
              </option>
            ))}
          </select>
        )}
        {selectedStatus?.imported && stage === "idle" && !showOverwriteConfirm && (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            이 연도는 이미 {selectedStatus.question_count}개 문제가 임포트되어 있습니다.
          </p>
        )}
      </div>

      {/* 덮어쓰기 확인 */}
      {showOverwriteConfirm && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 flex flex-col gap-3">
          <p className="font-semibold text-amber-800">이미 임포트된 데이터가 있습니다.</p>
          <p className="text-sm text-amber-700">{selectedYear}년 데이터를 어떻게 처리할까요?</p>
          <div className="flex gap-3">
            <button
              className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              onClick={() => startImport("overwrite")}
            >
              덮어쓰기
            </button>
            <button
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
              onClick={() => setShowOverwriteConfirm(false)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 임포트 시작 버튼 */}
      {!showOverwriteConfirm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-semibold text-gray-900 mb-4">2. 임포트 실행</h2>
          <button
            className="px-5 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!selectedYear || years.length === 0 || isRunning}
            onClick={() => startImport()}
          >
            {isRunning ? "임포트 중..." : "임포트 시작"}
          </button>
        </div>
      )}

      {/* 진행 상태 */}
      {isRunning && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-5">
          <h2 className="font-semibold text-gray-900">진행 상태</h2>

          {/* 단계 표시 */}
          <div className="flex flex-col gap-2 text-sm">
            <StepItem label="PDF 파싱" active={stage === "parsing"} done={stage === "saving" || stage === "tagging"} />
            <StepItem label="DB 저장" active={stage === "saving"} done={stage === "tagging"} />
            <StepItem label="단원 태깅 (LLM)" active={stage === "tagging"} done={false} />
          </div>

          {/* 태깅 프로그래스 바 */}
          {stage === "tagging" && tagging && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>
                  {tagging.subject} — <span className="text-gray-700 font-medium">{tagging.unit}</span>
                </span>
                <span>{tagging.current} / {tagging.total} ({taggingPercent}%)</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-gray-900 rounded-full transition-all duration-300"
                  style={{ width: `${taggingPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 에러 */}
      {stage === "error" && errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <p className="font-semibold mb-1">임포트 실패</p>
          <p>{errorMsg}</p>
        </div>
      )}

      {/* 완료 결과 */}
      {stage === "done" && result && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-gray-900">임포트 결과</h2>
          {result.success > 0 && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              ✓ {result.success}개 문제가 성공적으로 임포트됐습니다.
            </p>
          )}
          {result.failed > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-amber-700 font-semibold">실패 항목 {result.failed}개</p>
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                {result.failed_items.map((item, idx) => (
                  <div key={idx} className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                    <span className="text-red-500 font-semibold">[실패] </span>
                    {item.reason}
                    {item.text && <span className="text-gray-400"> — {item.text.slice(0, 60)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.success === 0 && result.failed === 0 && (
            <p className="text-sm text-gray-500">임포트된 문제가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}

function StepItem({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${done ? "text-gray-400" : active ? "text-gray-900" : "text-gray-300"}`}>
      {done ? (
        <span className="text-green-500">✓</span>
      ) : active ? (
        <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      ) : (
        <span className="w-4 h-4 border border-gray-200 rounded-full" />
      )}
      <span>{label}</span>
    </div>
  );
}
