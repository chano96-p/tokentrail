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

// 공개 DB에 올라가는 데이터라 allowlist에 적힌 프로젝트만 담는다. 비어 있으면 빈 스냅샷이다.
export async function buildSnapshot(
  db: PrismaClient,
  demo: DashboardConfig["demo"],
  o: Omit<RedactOptions, "projectRoot">,
): Promise<DemoSnapshot> {
  const projects = await db.project.findMany({
    where: { cwd: { in: demo.projects } },
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
      { ...o, projectRoot: cwdByProjectId.get(s.projectId) ?? null },
    ]),
  );
  const redact = (text: string | null, sessionId: string) =>
    text === null ? null : redactText(text, optionsBySessionId.get(sessionId)!);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: projects.map((p) => {
      const alias =
        demo.aliases[p.cwd] ?? `project-${demo.projects.indexOf(p.cwd) + 1}`;
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
