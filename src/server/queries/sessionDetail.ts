import type { DashboardConfig } from "@/core/config";
import type { EventKind, TimelineEventRecord } from "@/core/parser/types";
import { estimateCostUsd, totalTokens } from "@/core/pricing";
import type { PrismaClient } from "@prisma/client";
import {
  SESSION_LIST_INCLUDE,
  type SessionListItem,
  toSessionListItem,
} from "./sessions";

export type TimelineEventView = Omit<TimelineEventRecord, "timestamp"> & {
  timestamp: string;
  tokens: { input: number; output: number } | null;
};

export type Turn = { id: string; events: TimelineEventView[] };

export type SessionDetail = {
  session: SessionListItem & {
    estimatedCostUsd: number;
    unpricedModels: string[];
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
  turns: Turn[];
};

export async function getSessionDetail(
  db: PrismaClient,
  id: string,
  config: DashboardConfig,
): Promise<SessionDetail | null> {
  // 세 조회가 서로의 결과를 쓰지 않아 함께 보낸다.
  const [session, events, apiCalls] = await Promise.all([
    db.session.findUnique({ where: { id }, include: SESSION_LIST_INCLUDE }),
    db.timelineEvent.findMany({
      where: { sessionId: id },
      // 응답 타입에 없는 칼럼이라 가져오지 않는다.
      omit: { sourceFileId: true },
      orderBy: [{ timestamp: "asc" }, { uuid: "asc" }],
    }),
    db.apiCall.findMany({ where: { sessionId: id } }),
  ]);
  if (!session) return null;

  const unpricedModels = new Set<string>();
  let estimatedCostUsd = 0;
  for (const call of apiCalls) {
    const cost = estimateCostUsd(call, call.model, config.pricing);
    if (cost === null) unpricedModels.add(call.model);
    else estimatedCostUsd += cost;
  }

  const apiCallById = new Map(apiCalls.map((call) => [call.messageId, call]));
  // 한 API 호출이 thinking·text·tool_use 여러 이벤트로 나뉘어 배지를 첫 이벤트에만 단다.
  const seenApiCallIds = new Set<string>();

  const views: TimelineEventView[] = events.map((event) => {
    let tokens: TimelineEventView["tokens"] = null;
    const call = event.apiCallId ? apiCallById.get(event.apiCallId) : undefined;
    if (call && !seenApiCallIds.has(call.messageId)) {
      seenApiCallIds.add(call.messageId);
      tokens = {
        input: totalTokens(call) - call.outputTokens,
        output: call.outputTokens,
      };
    }
    return {
      ...event,
      kind: event.kind as EventKind,
      timestamp: event.timestamp.toISOString(),
      tokens,
    };
  });

  return {
    session: {
      ...toSessionListItem(session),
      estimatedCostUsd,
      unpricedModels: [...unpricedModels].sort(),
      inputTokens: session.inputTokens,
      outputTokens: session.outputTokens,
      cacheReadTokens: session.cacheReadTokens,
      cacheWriteTokens: session.cacheWriteTokens,
    },
    turns: groupIntoTurns(views),
  };
}

// 서브에이전트의 user 이벤트와 tool_result는 사람이 보낸 메시지가 아니라 턴을 나누지 않는다.
function isTurnStart(event: TimelineEventView): boolean {
  return event.kind === "user" && event.agentId === null;
}

function groupIntoTurns(events: TimelineEventView[]): Turn[] {
  const turns: Turn[] = [];
  let current: Turn | null = null;

  for (const event of events) {
    if (isTurnStart(event)) {
      current = { id: event.uuid, events: [] };
      turns.push(current);
    } else if (!current) {
      // 첫 user 메시지 이전 이벤트(system 등)
      current = { id: "start", events: [] };
      turns.push(current);
    }
    current.events.push(event);
  }
  return turns;
}
