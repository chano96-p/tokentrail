import type { DashboardConfig } from "@/core/config";
import { estimateCostUsd, totalTokens } from "@/core/pricing";
import { dateKeysBetween, toDateKey } from "@/core/time";
import type { PrismaClient } from "@prisma/client";

export type OverviewParams = {
  from: Date;
  to: Date;
  projectId?: string;
  model?: string;
};

export type DailyTokens = {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type Overview = {
  totalTokens: number;
  sessionCount: number;
  activeDays: number;
  estimatedCostUsd: number;
  unpricedModels: string[];
  subscriptionMonthlyUsd: number;
  daily: DailyTokens[];
  byProject: { projectId: string; name: string; totalTokens: number }[];
  byModel: { model: string; totalTokens: number }[];
  topSessions: {
    id: string;
    title: string | null;
    projectName: string;
    totalTokens: number;
  }[];
};

// 합계 내림차순, 같으면 키 오름차순. 동점이 상위 N 경계에 걸려도 결과가 매번 같도록 보조 키를 둔다.
function topEntries(
  totals: Map<string, number>,
  limit?: number,
): [string, number][] {
  return [...totals.entries()]
    .sort(([keyA, a], [keyB, b]) => b - a || (keyA < keyB ? -1 : 1))
    .slice(0, limit);
}

function addTo(totals: Map<string, number>, key: string, amount: number) {
  totals.set(key, (totals.get(key) ?? 0) + amount);
}

export async function getOverview(
  db: PrismaClient,
  params: OverviewParams,
  config: DashboardConfig,
): Promise<Overview> {
  // projectId는 where에 넣지 않는다. 복사된 호출의 대표 행을 전체 기준으로 고른 뒤 거른다(아래 uniqueRows).
  const rows = await db.apiCall.findMany({
    where: {
      timestamp: { gte: params.from, lte: params.to },
      model: params.model,
    },
    select: {
      sessionId: true,
      messageId: true,
      model: true,
      timestamp: true,
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheWrite5mTokens: true,
      cacheWrite1hTokens: true,
      session: { select: { projectId: true } },
    },
  });
  type Row = (typeof rows)[number];

  const inProject = (row: Row) =>
    !params.projectId || row.session.projectId === params.projectId;

  const sessionTotals = new Map<string, number>();
  for (const row of rows) {
    if (inProject(row)) {
      addTo(sessionTotals, row.sessionId, totalTokens(row));
    }
  }

  // 같은 messageId는 sessionId 사전순 첫 행 하나로 센다. 프로젝트 필터 여부와 관계없이 같은 행이 대표가 되어,
  // "p2만 보기"의 합계가 필터 없는 화면의 p2 막대와 같아진다.
  const representativeByMessageId = new Map<string, Row>();
  for (const row of rows) {
    const existing = representativeByMessageId.get(row.messageId);
    if (!existing || row.sessionId < existing.sessionId) {
      representativeByMessageId.set(row.messageId, row);
    }
  }
  const uniqueRows = [...representativeByMessageId.values()].filter(inProject);

  const daily = new Map<string, DailyTokens>(
    dateKeysBetween(params.from, params.to, config.timezone).map((date) => [
      date,
      {
        date,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    ]),
  );
  const projectTotals = new Map<string, number>();
  const modelTotals = new Map<string, number>();
  const unpricedModels = new Set<string>();
  const activeDates = new Set<string>();
  let total = 0;
  let estimatedCostUsd = 0;

  for (const row of uniqueRows) {
    const rowTotal = totalTokens(row);
    total += rowTotal;

    const dateKey = toDateKey(row.timestamp, config.timezone);
    activeDates.add(dateKey);
    const day = daily.get(dateKey);
    if (day) {
      day.inputTokens += row.inputTokens;
      day.outputTokens += row.outputTokens;
      day.cacheReadTokens += row.cacheReadTokens;
      day.cacheWriteTokens += row.cacheWrite5mTokens + row.cacheWrite1hTokens;
    }

    const cost = estimateCostUsd(row, row.model, config.pricing);
    if (cost === null) unpricedModels.add(row.model);
    else estimatedCostUsd += cost;

    addTo(projectTotals, row.session.projectId, rowTotal);
    addTo(modelTotals, row.model, rowTotal);
  }

  const topProjects = topEntries(projectTotals, 8);
  const topSessions = topEntries(sessionTotals, 5);
  // 이름·제목은 행마다 가져오지 않고 화면에 나갈 상위 N개만 조회한다.
  const [projects, sessions] = await Promise.all([
    db.project.findMany({
      where: { id: { in: topProjects.map(([id]) => id) } },
      select: { id: true, name: true },
    }),
    db.session.findMany({
      where: { id: { in: topSessions.map(([id]) => id) } },
      select: { id: true, title: true, project: { select: { name: true } } },
    }),
  ]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  return {
    totalTokens: total,
    sessionCount: sessionTotals.size,
    activeDays: activeDates.size,
    estimatedCostUsd,
    unpricedModels: [...unpricedModels].sort(),
    subscriptionMonthlyUsd: config.subscriptionMonthlyUsd,
    daily: [...daily.values()],
    byProject: topProjects.map(([projectId, totalTokens]) => ({
      projectId,
      name: projectById.get(projectId)?.name ?? projectId,
      totalTokens,
    })),
    byModel: topEntries(modelTotals).map(([model, totalTokens]) => ({
      model,
      totalTokens,
    })),
    topSessions: topSessions.map(([id, totalTokens]) => ({
      id,
      title: sessionById.get(id)?.title ?? null,
      projectName: sessionById.get(id)?.project.name ?? "",
      totalTokens,
    })),
  };
}
