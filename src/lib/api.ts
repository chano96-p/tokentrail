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
} as const;

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
  if (!response.ok) throw new Error(await errorMessage(response));
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
  sync: () => fetchJson<SyncSummary>("/api/sync", { method: "POST" }),
};
