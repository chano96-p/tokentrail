import { Dashboard, DashboardSkeleton } from "@/components/dashboard/Dashboard";
import { Suspense } from "react";

// 필터를 URL에서 읽는 useSearchParams는 빌드 때 값을 모르므로 Suspense 경계 안에서만 쓸 수 있다.
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}
