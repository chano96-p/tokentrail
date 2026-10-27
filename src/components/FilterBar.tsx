"use client";

import { api, queryKeys } from "@/lib/api";
import { useUrlFilters } from "@/lib/useUrlFilters";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

const RANGE_OPTIONS = [
  { value: "7d", label: "7일" },
  { value: "30d", label: "30일" },
];

const controlClass =
  "h-8 rounded-md border border-line bg-surface px-2 text-sm text-fg";

// 기본 select는 가장 긴 옵션 폭을 차지하고 화살표 모양도 OS마다 달라, 고른 값 길이에 맞추고 화살표를 직접 그린다.
// field-sizing을 지원하지 않는 브라우저에서는 max-w까지만 넓어진다.
function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <span className="relative inline-flex">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlClass} max-w-56 appearance-none truncate pr-7 field-sizing-content hover:border-muted`}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="pointer-events-none absolute top-1/2 right-2 size-3 -translate-y-1/2 text-muted"
      >
        <path
          d="M3 4.5 6 7.5 9 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function FilterBar() {
  const { values, set } = useUrlFilters();
  const filters = useQuery({
    queryKey: queryKeys.filters,
    queryFn: api.filters,
  });

  const hasCustomRange = Boolean(values.from && values.to);
  const [customOpen, setCustomOpen] = useState(hasCustomRange);
  const [draftFrom, setDraftFrom] = useState(values.from ?? "");
  const [draftTo, setDraftTo] = useState(values.to ?? "");

  const showCustom = customOpen || hasCustomRange;
  // 눌림 표시는 실제로 화면에 적용된 기간을 따른다. 날짜를 고르는 중에는 이전 range가 그대로 적용돼 있다.
  const activeRange = hasCustomRange ? "custom" : (values.range ?? "7d");

  function selectRange(range: string) {
    setCustomOpen(false);
    setDraftFrom("");
    setDraftTo("");
    set({ range, from: null, to: null });
  }

  // 날짜 두 개가 모두 정해지고 순서가 맞을 때만 URL에 반영한다. 직접 입력하면 min·max로 막히지 않는다.
  function changeDraft(nextFrom: string, nextTo: string) {
    setDraftFrom(nextFrom);
    setDraftTo(nextTo);
    if (nextFrom && nextTo && nextFrom <= nextTo) {
      set({ from: nextFrom, to: nextTo, range: null });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <div
        role="group"
        aria-label="기간"
        className="inline-flex h-8 gap-0.5 rounded-lg bg-fill p-0.5"
      >
        {RANGE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={activeRange === value}
            onClick={() => selectRange(value)}
            className="rounded-md px-3 text-muted not-aria-pressed:hover:text-fg aria-pressed:bg-surface aria-pressed:text-fg aria-pressed:shadow-sm"
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={activeRange === "custom"}
          aria-expanded={showCustom}
          onClick={() => setCustomOpen(true)}
          className="rounded-md px-3 text-muted not-aria-pressed:hover:text-fg aria-pressed:bg-surface aria-pressed:text-fg aria-pressed:shadow-sm"
        >
          직접 선택
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            aria-label="시작일"
            value={draftFrom}
            max={draftTo || undefined}
            onChange={(e) => changeDraft(e.target.value, draftTo)}
            className={controlClass}
          />
          <span className="text-muted">~</span>
          <input
            type="date"
            aria-label="종료일"
            value={draftTo}
            min={draftFrom || undefined}
            onChange={(e) => changeDraft(draftFrom, e.target.value)}
            className={controlClass}
          />
        </div>
      )}

      <FilterSelect
        label="프로젝트"
        value={values.project ?? ""}
        onChange={(project) => set({ project })}
      >
        <option value="">모든 프로젝트</option>
        {filters.data?.projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="모델"
        value={values.model ?? ""}
        onChange={(model) => set({ model })}
      >
        <option value="">모든 모델</option>
        {filters.data?.models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </FilterSelect>

      {filters.isError && (
        <span className="text-xs text-warn">
          프로젝트·모델 목록을 불러오지 못했습니다
        </span>
      )}
    </div>
  );
}
