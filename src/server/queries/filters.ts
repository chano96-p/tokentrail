import type { PrismaClient } from "@prisma/client";

export type FilterOptions = {
  projects: { id: string; name: string }[];
  models: string[];
  lastImportedAt: string | null;
  lastActivityAt: string | null; // 마지막 API 호출 시각. demo 모드의 기준 시각(getReferenceNow)과 같다
};

export async function getFilterOptions(
  db: PrismaClient,
): Promise<FilterOptions> {
  const [projects, modelGroups, latest, latestCall] = await Promise.all([
    db.project.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.apiCall.groupBy({
      by: ["model"],
      orderBy: { model: "asc" },
    }),
    db.importedFile.aggregate({
      _max: { importedAt: true },
    }),
    db.apiCall.aggregate({
      _max: { timestamp: true },
    }),
  ]);

  return {
    projects,
    models: modelGroups.map((g) => g.model),
    lastImportedAt: latest._max.importedAt?.toISOString() ?? null,
    lastActivityAt: latestCall._max.timestamp?.toISOString() ?? null,
  };
}
