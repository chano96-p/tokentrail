"use client";

import { useAppMode } from "@/app/providers";
import { formatChars, formatTokens } from "@/lib/format";
import type { TimelineEventView } from "@/server/queries/sessionDetail";
import { useState } from "react";
import { RawViewer } from "./RawViewer";

const KIND_LABEL: Record<TimelineEventView["kind"], string> = {
  user: "USR",
  assistant_text: "AST",
  tool_use: "TOOL",
  tool_result: "RES",
  thinking: "THK",
  system: "SYS",
};

function EventBody({ event }: { event: TimelineEventView }) {
  switch (event.kind) {
    case "user":
    case "assistant_text":
      return (
        <p className="line-clamp-4 whitespace-pre-wrap break-words">
          {event.preview || <span className="text-muted">(빈 메시지)</span>}
        </p>
      );
    case "tool_use":
      return (
        <p className="min-w-0 break-words">
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
        className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-2 rounded-md px-2 py-1.5 text-sm ${
          event.kind === "user" && !isSubagent ? "bg-fill" : ""
        }`}
      >
        <span className="font-mono text-[11px] text-muted">
          {KIND_LABEL[event.kind]}
        </span>
        <div className="min-w-0">
          {isSubagent && (
            <span className="mr-1.5 font-mono text-[11px] text-fg">
              [agent {event.agentId!.slice(0, 6)}]
            </span>
          )}
          <EventBody event={event} />
        </div>
        <div className="flex items-baseline gap-2 font-mono text-[11px] whitespace-nowrap text-muted">
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
