"use client";

import { api, queryKeys, retryUnlessClientError } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

// 원본 JSONL 줄은 DB에 없고 요청할 때 파일에서 읽는다(local 모드 전용).
export function RawViewer({
  sessionId,
  uuid,
}: {
  sessionId: string;
  uuid: string;
}) {
  const raw = useQuery({
    queryKey: queryKeys.rawLine(sessionId, uuid),
    queryFn: () => api.rawLine(sessionId, uuid),
    staleTime: Infinity,
    retry: retryUnlessClientError,
  });

  if (raw.isPending) {
    return <p className="text-xs text-muted">원본을 불러오는 중…</p>;
  }
  if (raw.isError) {
    return (
      <p className="text-xs text-warn">
        원본을 불러오지 못했습니다: {raw.error.message}
      </p>
    );
  }
  return (
    <pre className="max-h-96 overflow-auto rounded-md border border-line bg-bg p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap wrap-break-word">
      {JSON.stringify(raw.data.line, null, 2)}
    </pre>
  );
}
