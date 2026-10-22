import type { Prisma, PrismaClient } from "@prisma/client";

export type SessionListParams = {
  projectId?: string;
  model?: string;
  from?: Date;
  to?: Date;
  sort: "recent" | "tokens";
  cursor?: string;
  limit?: number;
};

export type SessionListItem = {
  id: string;
  title: string | null;
  projectName: string;
  gitBranch: string | null;
  startedAt: string;
  endedAt: string;
  totalTokens: number;
  subagentCount: number;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// id를 두 번째 기준으로 둬야 값이 같은 세션이 페이지 경계에서 겹치거나 빠지지 않는다.
const ORDER_BY_SORT: Record<
  SessionListParams["sort"],
  Prisma.SessionOrderByWithRelationInput[]
> = {
  recent: [{ startedAt: "desc" }, { id: "desc" }],
  tokens: [{ totalTokens: "desc" }, { id: "desc" }],
};

export const SESSION_LIST_INCLUDE = {
  project: { select: { name: true } },
} satisfies Prisma.SessionInclude;

export async function listSessions(
  db: PrismaClient,
  p: SessionListParams,
): Promise<{ items: SessionListItem[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(p.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const where: Prisma.SessionWhereInput = {
    projectId: p.projectId,
    startedAt: { gte: p.from, lte: p.to },
    // 모델은 세션 컬럼이 아니라 ApiCall에 있어 관계 필터로 건다.
    apiCalls: p.model ? { some: { model: p.model } } : undefined,
  };

  const rows = await db.session.findMany({
    where,
    orderBy: ORDER_BY_SORT[p.sort],
    // 다음 페이지가 있는지 보려고 하나 더 읽는다.
    take: limit + 1,
    // 커서 행 자체는 이전 페이지의 마지막 항목이라 건너뛴다.
    ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
    include: SESSION_LIST_INCLUDE,
  });

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);

  return {
    items: pageRows.map(toSessionListItem),
    nextCursor: hasMore ? (pageRows.at(-1)?.id ?? null) : null,
  };
}

export function toSessionListItem(
  row: Prisma.SessionGetPayload<{
    include: typeof SESSION_LIST_INCLUDE;
  }>,
): SessionListItem {
  return {
    id: row.id,
    title: row.title,
    gitBranch: row.gitBranch,
    totalTokens: row.totalTokens,
    subagentCount: row.subagentCount,
    projectName: row.project.name,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt.toISOString(),
  };
}
