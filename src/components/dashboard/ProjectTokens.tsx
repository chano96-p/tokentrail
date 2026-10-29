import { formatTokens } from "@/lib/format";
import type { Overview } from "@/server/queries/overview";
import { RankedBars } from "./Panel";

export function ProjectTokens({
  byProject,
  total,
}: {
  byProject: Overview["byProject"];
  total: number;
}) {
  if (byProject.length === 0) {
    return <p className="text-sm text-muted">이 기간에는 데이터가 없습니다.</p>;
  }
  return (
    <RankedBars
      rows={byProject.map((p) => ({
        key: p.projectId,
        label: p.name,
        value: p.totalTokens,
      }))}
      formatValue={formatTokens}
      total={total}
    />
  );
}
