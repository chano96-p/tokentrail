import { FilterBar } from "@/components/FilterBar";
import {
  SessionTable,
  SessionTableSkeleton,
} from "@/components/sessions/SessionTable";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "세션 · tokentrail" };

// FilterBar와 SessionTable은 URL 필터를 useSearchParams로 읽어 Suspense 경계 안에 둔다.
export default function SessionsPage() {
  return (
    <Suspense fallback={<SessionTableSkeleton />}>
      <div className="grid gap-4">
        <FilterBar />
        <SessionTable />
      </div>
    </Suspense>
  );
}
