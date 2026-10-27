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
  // columns는 열을 위에서 아래로 채워, 두 열로 나눠도 순위 순서대로 읽힌다.
  return (
    <RankedBars
      rows={byProject.map((p) => ({
        key: p.projectId,
        label: p.name,
        value: p.totalTokens,
      }))}
      formatValue={formatTokens}
      total={total}
      className="md:columns-2"
    />
  );
}
