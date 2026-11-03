"use client";

import { useTimeZone } from "@/app/providers";
import { toDateKey } from "@/core/time";
import { api, queryKeys } from "@/lib/api";
import { formatDateKeyShort } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";

// 데모 화면의 "최근 7일"은 오늘이 아니라 마지막 데이터 기준이라, 언제 기준인지 배너에 적는다.
export function DemoBanner() {
  const timeZone = useTimeZone();
  const filters = useQuery({
    queryKey: queryKeys.filters,
    queryFn: api.filters,
  });
  const lastActivityAt = filters.data?.lastActivityAt;
  const asOf = lastActivityAt
    ? `${formatDateKeyShort(toDateKey(new Date(lastActivityAt), timeZone))} 기준 `
    : "";
  return (
    <div className="bg-fg px-4 py-2 text-center text-xs text-bg">
      데모 · {asOf}실제 사용 데이터 · 본문 일부 마스킹
    </div>
  );
}
