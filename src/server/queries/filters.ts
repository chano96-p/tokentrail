import type { PrismaClient } from "@prisma/client";

export type FilterOptions = {
  projects: { id: string; name: string }[];
  models: string[];
  lastImportedAt: string | null;
};

export async function getFilterOptions(
  db: PrismaClient,
): Promise<FilterOptions> {
  const [projects, modelGroups, latest] = await Promise.all([
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
  ]);

  return {
    projects,
    models: modelGroups.map((g) => g.model),
    lastImportedAt: latest._max.importedAt?.toISOString() ?? null,
  };
}
