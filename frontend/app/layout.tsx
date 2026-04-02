import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "주택관리사 기출문제",
  description: "주택관리사 기출문제 학습 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full bg-gray-50 text-gray-900">
        {/* 상단 네비게이션 바 */}
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex items-center h-14 gap-6">
              <Link
                href="/"
                className="font-semibold text-gray-900 shrink-0"
              >
                주택관리사 기출
              </Link>
              <div className="flex items-center gap-5 text-sm text-gray-500">
                <Link href="/questions" className="hover:text-gray-900">
                  문제 조회
                </Link>
                <Link href="/quiz" className="hover:text-gray-900">
                  퀴즈
                </Link>
                <Link href="/wrong-answers" className="hover:text-gray-900">
                  오답노트
                </Link>
                <Link href="/stats" className="hover:text-gray-900">
                  통계
                </Link>
                <Link href="/bookmarks" className="hover:text-gray-900">
                  북마크
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* 페이지 콘텐츠 */}
        <main className="max-w-3xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
