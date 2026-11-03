import type { DashboardConfig } from "@/core/config";
import type {
  ApiCall,
  PrismaClient,
  Project,
  Session,
  TimelineEvent,
} from "@prisma/client";
import { redactText, type RedactOptions } from "./redact";

export type DemoSnapshot = {
  version: 1;
  exportedAt: string;
  projects: Project[];
  sessions: Session[];
  apiCalls: Omit<ApiCall, "sourceFileId">[];
  events: Omit<TimelineEvent, "sourceFileId">[];
};

export type DemoOptions = DashboardConfig["demo"] & {
  redactWords?: string[];
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

// dashboard.demo.json은 손으로 고치는 파일이라, 형식이 틀리면 공개 범위가 바뀌기 전에 멈춘다.
export function parseDemoOptions(raw: unknown): Required<DemoOptions> {
  const fail = () => {
    throw new Error(
      'dashboard.demo.json은 { "projects": string[], "aliases"?: { [cwd]: string }, "redactWords"?: string[] } 형식이어야 합니다',
    );
  };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail();
  const {
    projects,
    aliases = {},
    redactWords = [],
  } = raw as Record<string, unknown>;
  if (!isStringArray(projects) || !isStringArray(redactWords)) fail();
  if (
    typeof aliases !== "object" ||
    aliases === null ||
    Array.isArray(aliases) ||
    !Object.values(aliases).every((v) => typeof v === "string")
  ) {
    fail();
  }
  return {
    projects: projects as string[],
    aliases: aliases as Record<string, string>,
    redactWords: redactWords as string[],
  };
}

// 공개 DB에 올라가는 데이터라 allowlist에 적힌 프로젝트만 담는다. 비어 있으면 빈 스냅샷이다.
export async function buildSnapshot(
  db: PrismaClient,
  demo: DemoOptions,
  o: Omit<RedactOptions, "projectRoot" | "words">,
): Promise<DemoSnapshot> {
  // Prisma는 `in: undefined`를 조건 없음으로 읽어 전체 프로젝트를 돌려주므로, 배열이 아니면 아무것도 담지 않는다.
  const allowlist = Array.isArray(demo.projects) ? demo.projects : [];
  const projects = await db.project.findMany({
    where: { cwd: { in: allowlist } },
  });
  const projectIds = projects.map((p) => p.id);
  // export 중에 sync가 돌아도 세 목록이 같은 시점을 보도록 한 트랜잭션에서 읽는다.
  const [sessions, apiCalls, events] = await db.$transaction([
    db.session.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { startedAt: "asc" },
    }),
    db.apiCall.findMany({
      where: { session: { projectId: { in: projectIds } } },
      omit: { sourceFileId: true },
    }),
    db.timelineEvent.findMany({
      where: { session: { projectId: { in: projectIds } } },
      omit: { sourceFileId: true },
    }),
  ]);

  // 세션 텍스트 안의 경로는 그 세션 프로젝트의 원래 cwd 기준으로 상대 경로로 바꾼다.
  const cwdByProjectId = new Map(projects.map((p) => [p.id, p.cwd]));
  const optionsBySessionId = new Map(
    sessions.map((s) => [
      s.id,
      {
        ...o,
        projectRoot: cwdByProjectId.get(s.projectId) ?? null,
        words: demo.redactWords,
      },
    ]),
  );
  const redact = (text: string | null, sessionId: string) =>
    text === null ? null : redactText(text, optionsBySessionId.get(sessionId)!);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: projects.map((p) => {
      const alias =
        demo.aliases[p.cwd] ?? `project-${allowlist.indexOf(p.cwd) + 1}`;
      return { ...p, cwd: alias, name: alias };
    }),
    sessions: sessions.map((s) => ({
      ...s,
      title: redact(s.title, s.id),
      gitBranch: redact(s.gitBranch, s.id),
    })),
    apiCalls,
    events: events.map((e) => ({
      ...e,
      preview: redact(e.preview, e.sessionId),
      inputSummary: redact(e.inputSummary, e.sessionId),
    })),
  };
}
