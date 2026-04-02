"use client";

/**
 * 학습 통계 페이지.
 * recharts를 사용하여 과목별/연도별 정답률 차트를 렌더링한다.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { fetchStats, type StatsResponse } from "../../lib/api";

export default function StatsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "알 수 없는 오류";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-gray-400 animate-pulse">
        통계를 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        <p className="font-semibold mb-1">통계를 불러오지 못했습니다.</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!stats) return null;

  const progressPercent =
    stats.progress.total > 0
      ? Math.round(stats.progress.rate * 100)
      : 0;

  // 과목별 차트 데이터 (가로 막대 — rate % 표시)
  const subjectChartData = stats.by_subject.map((s) => ({
    name: s.subject,
    정답률: Math.round(s.rate * 100),
    시도: s.attempted,
  }));

  // 연도별 차트 데이터 (세로 막대)
  const yearChartData = [...stats.by_year]
    .sort((a, b) => a.year - b.year)
    .map((y) => ({
      name: `${y.year}년`,
      정답률: Math.round(y.rate * 100),
      시도: y.attempted,
    }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">학습 통계</h1>
        <p className="text-sm text-gray-500">나의 학습 현황을 한눈에 확인하세요.</p>
      </div>

      {/* ── 1. 전체 진도 ── */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-3">
        <h2 className="font-semibold text-gray-900">전체 진도</h2>
        {stats.progress.total === 0 ? (
          <p className="text-sm text-gray-400">아직 데이터가 없습니다.</p>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{stats.progress.attempted.toLocaleString()}</span>
              {" / "}
              {stats.progress.total.toLocaleString()} 문제
              {" "}
              <span className="text-gray-500">({progressPercent}%)</span>
            </p>
            {/* 진행 바 */}
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 bg-gray-900 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </>
        )}
      </section>

      {/* ── 2. 연속 학습일 ── */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-2">
        <h2 className="font-semibold text-gray-900">연속 학습일</h2>
        {stats.streak.best === 0 ? (
          <p className="text-sm text-gray-400">아직 데이터가 없습니다.</p>
        ) : (
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-semibold text-gray-900">{stats.streak.current}</p>
              <p className="text-xs text-gray-500 mt-1">현재 연속일</p>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="text-center">
              <p className="text-3xl font-semibold text-gray-400">{stats.streak.best}</p>
              <p className="text-xs text-gray-500 mt-1">최장 연속일</p>
            </div>
          </div>
        )}
      </section>

      {/* ── 3. 과목별 정답률 ── */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-gray-900">과목별 정답률</h2>
        {subjectChartData.length === 0 ? (
          <p className="text-sm text-gray-400">아직 데이터가 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={subjectChartData.length * 44 + 20}>
            <BarChart
              data={subjectChartData}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={90}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => [`${value}%`, "정답률"]}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="정답률" radius={[0, 3, 3, 0]}>
                {subjectChartData.map((_, idx) => (
                  <Cell key={idx} fill="#1f2937" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ── 4. 연도별 정답률 ── */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-gray-900">연도별 정답률</h2>
        {yearChartData.length === 0 ? (
          <p className="text-sm text-gray-400">아직 데이터가 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={yearChartData}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value) => [`${value}%`, "정답률"]}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="정답률" radius={[3, 3, 0, 0]}>
                {yearChartData.map((_, idx) => (
                  <Cell key={idx} fill="#1f2937" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ── 5. 취약 단원 ── */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-gray-900">취약 단원 <span className="text-sm font-normal text-gray-400">(정답률 낮은 순 상위 5)</span></h2>
        {stats.weak_units.length === 0 ? (
          <p className="text-sm text-gray-400">아직 데이터가 없습니다. (단원별 3회 이상 풀이 필요)</p>
        ) : (
          <div className="flex flex-col gap-2">
            {stats.weak_units.map((wu, idx) => (
              <Link
                key={idx}
                href={`/questions?unit=${encodeURIComponent(wu.unit)}`}
                className="flex items-center gap-3 px-4 py-3 border border-gray-100 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-800 w-5 shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{wu.unit}</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500 shrink-0">
                  <span>{wu.attempted}회 시도</span>
                  <span className="font-semibold text-red-500">{Math.round(wu.rate * 100)}%</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── 6. 최근 퀴즈 기록 ── */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-gray-900">최근 퀴즈 기록 <span className="text-sm font-normal text-gray-400">(최근 30개)</span></h2>
        {stats.recent_sessions.length === 0 ? (
          <p className="text-sm text-gray-400">아직 데이터가 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {stats.recent_sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 px-4 py-3 border border-gray-100 rounded-lg text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-gray-400 text-xs mb-0.5">{s.date}</p>
                  <p className="text-gray-700 truncate">{s.scope}</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500 shrink-0">
                  <span>총 {s.total}문제</span>
                  <span className="font-semibold text-gray-900">{Math.round(s.rate * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
