"use client";

import { useAppMode } from "@/app/providers";
import { formatChars, formatTokens } from "@/lib/format";
import type { TimelineEventView } from "@/server/queries/sessionDetail";
import { useState } from "react";
import { RawViewer } from "./RawViewer";

const KIND_LABEL: Record<TimelineEventView["kind"], string> = {
  user: "사용자",
  assistant_text: "응답",
  tool_use: "도구",
  tool_result: "결과",
  thinking: "생각",
  system: "시스템",
};

function EventBody({ event }: { event: TimelineEventView }) {
  switch (event.kind) {
    case "user":
    case "assistant_text":
      return (
        <p className="line-clamp-4 whitespace-pre-wrap wrap-break-word">
          {event.preview || <span className="text-muted">(빈 메시지)</span>}
        </p>
      );
    case "tool_use":
      return (
        <p className="min-w-0 wrap-break-word">
          <span className="font-medium">{event.toolName ?? "tool"}</span>{" "}
          {event.inputSummary && (
            <code className="font-mono text-xs text-muted">
              {event.inputSummary}
            </code>
          )}
        </p>
      );
    case "tool_result":
      return (
        <p className={event.isError ? "text-warn" : "text-muted"}>
          {event.isError ? "✗ 오류" : "✓ 결과"} ·{" "}
          {formatChars(event.contentLength)}
        </p>
      );
    case "thinking":
      return (
        <p className="text-muted">
          생각함 ({formatChars(event.contentLength)})
        </p>
      );
    case "system":
      return (
        <p
          className={`font-mono text-xs ${event.isError ? "text-warn" : "text-muted"}`}
        >
          {event.preview ?? "system"}
        </p>
      );
  }
}

export function EventRow({
  sessionId,
  event,
}: {
  sessionId: string;
  event: TimelineEventView;
}) {
  const mode = useAppMode();
  const [rawOpen, setRawOpen] = useState(false);
  const isSubagent = event.agentId !== null;

  return (
    <li
      className={isSubagent ? "ml-4 border-l-2 border-line pl-3 sm:ml-7" : ""}
    >
      <div
        className={`grid grid-cols-[3rem_minmax(0,1fr)] items-baseline sm:grid-cols-[3rem_minmax(0,1fr)_auto] gap-2 rounded-lg px-2 py-1.5 text-sm ${
          event.kind === "user" && !isSubagent ? "bg-fill" : ""
        }`}
      >
        <span className="text-xs text-muted">{KIND_LABEL[event.kind]}</span>
        <div className="min-w-0">
          {isSubagent && (
            <span className="mr-1.5 font-mono text-[11px] text-fg">
              [agent {event.agentId!.slice(0, 6)}]
            </span>
          )}
          <EventBody event={event} />
        </div>
        {/* 좁은 화면에서는 토큰 배지가 본문 폭을 줄이지 않게 본문 아래 줄로 내린다. */}
        <div className="col-start-2 flex items-baseline gap-2 text-xs whitespace-nowrap text-muted empty:hidden sm:col-start-auto">
          {event.tokens && (
            <span className="tabular-nums">
              {formatTokens(event.tokens.input)} in /{" "}
              {formatTokens(event.tokens.output)} out
            </span>
          )}
          {mode === "local" && (
            <button
              type="button"
              aria-expanded={rawOpen}
              onClick={() => setRawOpen((open) => !open)}
              className="rounded px-1 text-muted hover:text-fg aria-expanded:text-fg"
            >
              원본
            </button>
          )}
        </div>
      </div>
      {rawOpen && (
        <div className="px-2 pb-2">
          <RawViewer sessionId={sessionId} uuid={event.uuid} />
        </div>
      )}
    </li>
  );
}
