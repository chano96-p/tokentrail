"use client";

import { useTimeZone } from "@/app/providers";
import { formatDateTime } from "@/lib/format";
import { useUrlFilters } from "@/lib/useUrlFilters";
import type { Turn } from "@/server/queries/sessionDetail";
import { EventRow } from "./EventRow";

const HIDEABLE_KINDS = ["thinking", "system"] as const;

function HideToggles({
  hidden,
  onChange,
}: {
  hidden: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  return (
    <fieldset className="flex items-center gap-3 text-xs text-muted">
      <legend className="sr-only">숨기기</legend>
      <span aria-hidden="true">숨기기:</span>
      {HIDEABLE_KINDS.map((kind) => (
        <label key={kind} className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={hidden.has(kind)}
            onChange={(e) => {
              const next = new Set(hidden);
              if (e.target.checked) next.add(kind);
              else next.delete(kind);
              onChange(next);
            }}
            className="accent-(--fg)"
          />
          {kind}
        </label>
      ))}
    </fieldset>
  );
}

export function Timeline({
  sessionId,
  turns,
}: {
  sessionId: string;
  turns: Turn[];
}) {
  const timeZone = useTimeZone();
  const { values, set } = useUrlFilters();
  // 숨길 종류는 URL에 둬서 새로고침·공유해도 유지된다. 기본은 숨김 없음.
  const hidden = new Set((values.hide ?? "").split(",").filter(Boolean));

  const visibleTurns = turns
    .map((turn) => ({
      ...turn,
      events: turn.events.filter((event) => !hidden.has(event.kind)),
    }))
    .filter((turn) => turn.events.length > 0);

  let turnNumber = 0;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted">
          타임라인 · 턴 {turns.filter((turn) => turn.id !== "start").length}개
        </h2>
        <HideToggles
          hidden={hidden}
          onChange={(next) => set({ hide: [...next].join(",") })}
        />
      </div>
      {visibleTurns.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-6 text-center text-sm text-muted">
          표시할 이벤트가 없습니다.
        </p>
      ) : (
        visibleTurns.map((turn) => {
          const label =
            turn.id === "start" ? "세션 시작" : `턴 ${++turnNumber}`;
          return (
            <section
              key={turn.id}
              aria-label={label}
              className="rounded-lg border border-line bg-surface p-2"
            >
              <h3 className="flex justify-between px-2 pb-1 text-xs text-muted">
                <span>{label}</span>
                <span className="font-mono tabular-nums">
                  {formatDateTime(turn.events[0].timestamp, timeZone)}
                </span>
              </h3>
              <ol className="grid gap-0.5">
                {turn.events.map((event) => (
                  <EventRow
                    key={event.uuid}
                    sessionId={sessionId}
                    event={event}
                  />
                ))}
              </ol>
            </section>
          );
        })
      )}
    </div>
  );
}
