"use client";

import { LoadError, StaleNotice } from "@/components/StatusMessages";
import { api, ApiError, queryKeys, retryUnlessClientError } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { SessionHeader } from "./SessionHeader";
import { Timeline } from "./Timeline";

export function SessionDetailSkeleton() {
  return (
    <div className="grid animate-pulse gap-4" aria-busy="true">
      <div className="h-24 rounded-lg bg-line/60" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-32 rounded-lg bg-line/60" />
      ))}
    </div>
  );
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function SessionDetailView({ id }: { id: string }) {
  const detail = useQuery({
    queryKey: queryKeys.session(id),
    queryFn: () => api.session(id),
    retry: retryUnlessClientError,
  });

  if (detail.isPending) return <SessionDetailSkeleton />;
  if (isNotFound(detail.error)) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm">
        <p>세션을 찾을 수 없습니다</p>
        <Link
          href="/sessions"
          className="mt-3 inline-block underline underline-offset-2"
        >
          세션 목록으로
        </Link>
      </div>
    );
  }
  if (!detail.data) {
    return <LoadError error={detail.error} onRetry={() => detail.refetch()} />;
  }

  return (
    <div className="grid gap-6">
      {detail.isError && <StaleNotice />}
      <SessionHeader session={detail.data.session} />
      <Timeline sessionId={id} turns={detail.data.turns} />
    </div>
  );
}
