/**
 * 백엔드 API 호출 유틸리티.
 * 모든 API 요청은 이 파일을 통해 관리한다.
 */

export const API_BASE_URL = "http://localhost:8000";

/**
 * 기본 fetch 래퍼 — 에러 발생 시 한국어 메시지 포함.
 */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`서버 오류 (${res.status}): ${text || "알 수 없는 오류가 발생했습니다."}`);
  }

  return res.json() as Promise<T>;
}

/** 서버 상태 확인 */
export function checkHealth() {
  return apiFetch<{ status: string; message: string }>("/health");
}

// ---------------------------------------------------------------------------
// 임포트 API
// ---------------------------------------------------------------------------

export interface YearItem {
  year: string;
}

export interface ImportStatus {
  year: string;
  imported: boolean;
  question_count: number;
}

export interface FailedItem {
  reason: string;
  page: number | null;
  text: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  failed_items: FailedItem[];
}

/** data/exams/ 아래 연도 폴더 목록 조회 */
export function fetchImportYears(): Promise<YearItem[]> {
  return apiFetch<YearItem[]>("/api/import/years");
}

/** 특정 연도 임포트 상태 조회 */
export function fetchImportStatus(year: string): Promise<ImportStatus> {
  return apiFetch<ImportStatus>(`/api/import/status/${year}`);
}

/** 임포트 실행 */
export function runImport(year: string, action?: "overwrite" | "skip"): Promise<ImportResult> {
  return apiFetch<ImportResult>("/api/import/run", {
    method: "POST",
    body: JSON.stringify({ year, action }),
  });
}

// ---------------------------------------------------------------------------
// 문제 조회 API
// ---------------------------------------------------------------------------

export interface QuestionSummary {
  id: number;
  year: number;
  exam_type: string;
  session: string | null;
  subject: string;
  unit: string | null;
  question_type: string;
  question_number: number;
  question_text: string;
  has_bookmark: boolean;
  bookmark_tag: string | null;
  has_wrong: boolean;
}

export interface QuestionDetail extends QuestionSummary {
  options: string[] | null;
  answer: string | null;
  wrong_count: number;
}

export interface QuestionListResponse {
  items: QuestionSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface QuestionMeta {
  years: number[];
  subjects: string[];
  units: Record<string, string[]>;  // 과목별 단원 목록
}

export interface QuestionFilters {
  q?: string;
  year?: number;
  exam_type?: string;
  subject?: string;
  unit?: string;
  question_type?: string;
  bookmarked?: boolean;
  wrong_only?: boolean;
  page?: number;
  page_size?: number;
}

/** 문제 목록 조회 */
export function fetchQuestions(filters: QuestionFilters = {}): Promise<QuestionListResponse> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.year !== undefined) params.set("year", String(filters.year));
  if (filters.exam_type) params.set("exam_type", filters.exam_type);
  if (filters.subject) params.set("subject", filters.subject);
  if (filters.unit) params.set("unit", filters.unit);
  if (filters.question_type) params.set("question_type", filters.question_type);
  if (filters.bookmarked !== undefined) params.set("bookmarked", String(filters.bookmarked));
  if (filters.wrong_only !== undefined) params.set("wrong_only", String(filters.wrong_only));
  if (filters.page !== undefined) params.set("page", String(filters.page));
  if (filters.page_size !== undefined) params.set("page_size", String(filters.page_size));

  const qs = params.toString();
  return apiFetch<QuestionListResponse>(`/api/questions${qs ? `?${qs}` : ""}`);
}

/** 문제 상세 조회 */
export function fetchQuestion(id: number): Promise<QuestionDetail> {
  return apiFetch<QuestionDetail>(`/api/questions/${id}`);
}

/** 필터용 메타데이터 조회 */
export function fetchQuestionMeta(): Promise<QuestionMeta> {
  return apiFetch<QuestionMeta>("/api/questions/meta");
}

// ---------------------------------------------------------------------------
// 퀴즈 API
// ---------------------------------------------------------------------------

export interface FilterState {
  year?: number;
  exam_type?: string;
  subject?: string;
  unit?: string;
  question_type?: string;
  bookmarked?: boolean;
  wrong_only?: boolean;
}

export interface StartQuizRequest {
  filter?: FilterState;
  mode: "ordered" | "random";
  limit?: number;
}

export interface StartQuizResponse {
  session_id: number;
  total: number;
  first_question_id: number;
}

export interface QuizQuestion {
  id: number;
  year: number;
  exam_type: string;
  session: string | null;
  subject: string;
  unit: string | null;
  question_type: string;
  question_number: number;
  question_text: string;
  options: string[] | null;
  answer: string | null;
  index: number;
  total: number;
}

export interface SubmitAnswerRequest {
  question_id: number;
  user_answer: string;
  index: number;
}

export interface SubmitAnswerResponse {
  is_correct: boolean;
  correct_answer: string | null;
  is_last: boolean;
}

export interface WrongQuestionSummary {
  id: number;
  year: number;
  subject: string;
  question_number: number;
  question_text: string;
}

export interface QuizResultResponse {
  total: number;
  correct: number;
  wrong: number;
  rate: number;
  wrong_questions: WrongQuestionSummary[];
}

export interface QuizSessionSummary {
  id: number;
  started_at: string;
  ended_at: string | null;
  total: number;
  correct: number;
  scope_description: string;
  rate: number;
}

/** 퀴즈 시작 */
export function startQuiz(body: StartQuizRequest): Promise<StartQuizResponse> {
  return apiFetch<StartQuizResponse>("/api/quiz/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** 퀴즈 세션의 N번째 문제 조회 */
export function fetchQuizQuestion(sessionId: number, index: number): Promise<QuizQuestion> {
  return apiFetch<QuizQuestion>(`/api/quiz/${sessionId}/question/${index}`);
}

/** 답안 제출 */
export function submitQuizAnswer(
  sessionId: number,
  body: SubmitAnswerRequest
): Promise<SubmitAnswerResponse> {
  return apiFetch<SubmitAnswerResponse>(`/api/quiz/${sessionId}/answer`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** 퀴즈 결과 조회 */
export function fetchQuizResult(sessionId: number): Promise<QuizResultResponse> {
  return apiFetch<QuizResultResponse>(`/api/quiz/${sessionId}/result`);
}

/** 최근 퀴즈 세션 목록 */
export function fetchQuizSessions(): Promise<QuizSessionSummary[]> {
  return apiFetch<QuizSessionSummary[]>("/api/quiz/sessions");
}

// ---------------------------------------------------------------------------
// 오답노트 API
// ---------------------------------------------------------------------------

export interface WrongAnswerItem {
  id: number;
  question_id: number;
  wrong_count: number;
  last_wrong_at: string;
  has_explanation: boolean;
  year: number;
  exam_type: string;
  session: string | null;
  subject: string;
  unit: string | null;
  question_number: number;
  question_text: string;
  question_type: string;
  has_bookmark: boolean;
  bookmark_tag: string | null;
}

export interface WrongAnswerDetail extends WrongAnswerItem {
  options: string[] | null;
  answer: string | null;
  explanation: string | null;
}

export interface WrongAnswerListResponse {
  items: WrongAnswerItem[];
  total: number;
}

/** 오답 목록 조회 */
export function fetchWrongAnswers(
  sort: "recent" | "count" | "subject" = "recent",
  page = 1,
  pageSize = 20
): Promise<WrongAnswerListResponse> {
  return apiFetch<WrongAnswerListResponse>(
    `/api/wrong-answers?sort=${sort}&page=${page}&page_size=${pageSize}`
  );
}

/** 오답 상세 조회 */
export function fetchWrongAnswer(questionId: number): Promise<WrongAnswerDetail> {
  return apiFetch<WrongAnswerDetail>(`/api/wrong-answers/${questionId}`);
}

/** 오답노트에서 제거 */
export function deleteWrongAnswer(questionId: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/wrong-answers/${questionId}`, {
    method: "DELETE",
  });
}

/** LLM 해설 생성 */
export function generateExplanation(questionId: number): Promise<{ explanation: string }> {
  return apiFetch<{ explanation: string }>(`/api/wrong-answers/${questionId}/explanation`, {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// 통계 API
// ---------------------------------------------------------------------------

export interface StatsProgress {
  total: number;
  attempted: number;
  rate: number;
}

export interface SubjectStats {
  subject: string;
  attempted: number;
  correct: number;
  rate: number;
}

export interface YearStats {
  year: number;
  attempted: number;
  correct: number;
  rate: number;
}

export interface WeakUnit {
  unit: string;
  attempted: number;
  correct: number;
  rate: number;
}

export interface RecentSession {
  id: number;
  date: string;
  scope: string;
  total: number;
  correct: number;
  rate: number;
}

export interface StreakStats {
  current: number;
  best: number;
}

export interface StatsResponse {
  progress: StatsProgress;
  by_subject: SubjectStats[];
  by_year: YearStats[];
  weak_units: WeakUnit[];
  recent_sessions: RecentSession[];
  streak: StreakStats;
}

/** 전체 통계 조회 */
export function fetchStats(): Promise<StatsResponse> {
  return apiFetch<StatsResponse>("/api/stats");
}

// ---------------------------------------------------------------------------
// 북마크 API
// ---------------------------------------------------------------------------

export interface BookmarkItem {
  id: number;
  question_id: number;
  tag: string;
  created_at: string;
  year: number;
  exam_type: string;
  session: string | null;
  subject: string;
  unit: string | null;
  question_number: number;
  question_text: string;
  has_wrong: boolean;
}

export interface BookmarkListResponse {
  items: BookmarkItem[];
  total: number;
}

/** 북마크 목록 조회 */
export function fetchBookmarks(
  tag?: string,
  page = 1,
  pageSize = 20
): Promise<BookmarkListResponse> {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  return apiFetch<BookmarkListResponse>(`/api/bookmarks?${params.toString()}`);
}

/** 북마크 추가/변경 */
export function addBookmark(questionId: number, tag: string): Promise<{ question_id: number; tag: string }> {
  return apiFetch<{ question_id: number; tag: string }>("/api/bookmarks", {
    method: "POST",
    body: JSON.stringify({ question_id: questionId, tag }),
  });
}

/** 북마크 제거 */
export function deleteBookmark(questionId: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/bookmarks/${questionId}`, {
    method: "DELETE",
  });
}
