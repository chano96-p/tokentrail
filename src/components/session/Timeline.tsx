"use client";

import { useTimeZone } from "@/app/providers";
import { Panel } from "@/components/dashboard/Panel";
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
    <fieldset className="flex shrink-0 items-center gap-3 text-xs text-muted">
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
            className="accent-fg"
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
    <Panel
      title="타임라인"
      action={
        <HideToggles
          hidden={hidden}
          onChange={(next) => set({ hide: [...next].join(",") })}
        />
      }
    >
      {visibleTurns.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
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
              className="-mx-5 border-t border-line px-3 py-3 sm:-mx-6 sm:px-4"
            >
              <h3 className="flex justify-between px-2 pb-1.5 text-xs text-muted">
                <span className="font-medium text-fg">{label}</span>
                <span className="tabular-nums">
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
    </Panel>
  );
}
