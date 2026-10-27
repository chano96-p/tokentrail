import type { SyncSummary } from "@/core/importer/sync";
import type { FilterOptions } from "@/server/queries/filters";
import type { Overview } from "@/server/queries/overview";
import type { SessionDetail } from "@/server/queries/sessionDetail";
import type { SessionListItem } from "@/server/queries/sessions";

export type SessionListPage = {
  items: SessionListItem[];
  nextCursor: string | null;
};

export const queryKeys = {
  overview: (p: Record<string, string>) => ["overview", p],
  filters: ["filters"],
  sessions: (p: Record<string, string>) => ["sessions", p],
  session: (id: string) => ["session", id],
  rawLine: (id: string, uuid: string) => ["rawLine", id, uuid],
} as const;

// 상태 코드를 남겨 화면이 404(없는 세션)와 서버 오류를 구분할 수 있게 한다.
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const MAX_RETRIES = 3;

// 4xx는 다시 요청해도 결과가 같아(없는 세션·원본 줄, demo 403) 재시도하지 않는다.
export function retryUnlessClientError(
  failureCount: number,
  error: Error,
): boolean {
  const isClientError =
    error instanceof ApiError && error.status >= 400 && error.status < 500;
  return !isClientError && failureCount < MAX_RETRIES;
}

// 처리되지 않은 서버 예외는 Next 기본 500 응답이라 본문이 JSON이 아닐 수 있다.
async function errorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const body: unknown = JSON.parse(text);
    if (
      typeof body === "object" &&
      body !== null &&
      typeof (body as { error?: unknown }).error === "string"
    ) {
      return (body as { error: string }).error;
    }
  } catch {
    // JSON이 아니면 상태 코드로 메시지를 만든다.
  }
  return `${response.status} ${response.statusText}`.trim();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status);
  }
  return (await response.json()) as T;
}

function withParams(path: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params).toString();
  return query ? `${path}?${query}` : path;
}

export const api = {
  overview: (params: Record<string, string>) =>
    fetchJson<Overview>(withParams("/api/overview", params)),
  filters: () => fetchJson<FilterOptions>("/api/filters"),
  sessions: (params: Record<string, string>) =>
    fetchJson<SessionListPage>(withParams("/api/sessions", params)),
  session: (id: string) =>
    fetchJson<SessionDetail>(`/api/sessions/${encodeURIComponent(id)}`),
  // uuid의 '#n'이 URL fragment로 잘리지 않게 인코딩한다.
  rawLine: (id: string, uuid: string) =>
    fetchJson<{ line: unknown }>(
      `/api/sessions/${encodeURIComponent(id)}/events/${encodeURIComponent(uuid)}/raw`,
    ),
  sync: () => fetchJson<SyncSummary>("/api/sync", { method: "POST" }),
};
