"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      {/* 환영 메시지 */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          주택관리사 기출문제 학습
        </h1>
        <p className="text-gray-500">
          PDF 파일을 임포트하여 기출문제를 학습하세요.
        </p>
      </div>

      {/* PDF 임포트 안내 카드 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="font-semibold text-gray-900 mb-2">시작하기</h2>
        <p className="text-sm text-gray-500 mb-4">
          기출문제 PDF 파일을 <code className="bg-gray-100 px-1 rounded">data/exams/</code> 폴더에 넣고 임포트하면 학습을 시작할 수 있습니다.
        </p>
        <Link
          href="/import"
          className="inline-block px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          PDF 임포트하기
        </Link>
      </div>

      {/* 빠른 이동 */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/questions"
          className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400"
        >
          <div className="font-semibold text-gray-900 mb-1">문제 조회</div>
          <div className="text-sm text-gray-500">임포트된 문제를 검색하고 확인합니다.</div>
        </Link>
        <Link
          href="/quiz"
          className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400"
        >
          <div className="font-semibold text-gray-900 mb-1">퀴즈</div>
          <div className="text-sm text-gray-500">원하는 범위로 퀴즈를 풀어봅니다.</div>
        </Link>
        <Link
          href="/wrong-answers"
          className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400"
        >
          <div className="font-semibold text-gray-900 mb-1">오답노트</div>
          <div className="text-sm text-gray-500">틀린 문제를 모아 복습합니다.</div>
        </Link>
        <Link
          href="/stats"
          className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400"
        >
          <div className="font-semibold text-gray-900 mb-1">통계</div>
          <div className="text-sm text-gray-500">학습 현황을 한눈에 파악합니다.</div>
        </Link>
      </div>
    </div>
  );
}
