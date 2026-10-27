"use client";

import { api, queryKeys } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { useUrlFilters } from "@/lib/useUrlFilters";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

const RANGE_OPTIONS = [
  { value: "7d", label: "7일" },
  { value: "30d", label: "30일" },
];

const selectClass =
  "rounded-md border border-line bg-surface px-2 py-1 text-sm text-fg";

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
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <div
        role="group"
        aria-label="기간"
        className="inline-flex overflow-hidden rounded-md border border-line"
      >
        {RANGE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={activeRange === value}
            onClick={() => selectRange(value)}
            className="px-3 py-1 text-muted aria-pressed:bg-accent aria-pressed:text-surface"
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={activeRange === "custom"}
          aria-expanded={showCustom}
          onClick={() => setCustomOpen(true)}
          className="px-3 py-1 text-muted aria-expanded:text-fg aria-pressed:bg-accent aria-pressed:text-surface"
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
            className={selectClass}
          />
          <span className="text-muted">~</span>
          <input
            type="date"
            aria-label="종료일"
            value={draftTo}
            min={draftFrom || undefined}
            onChange={(e) => changeDraft(draftFrom, e.target.value)}
            className={selectClass}
          />
        </div>
      )}

      <select
        aria-label="프로젝트"
        value={values.project ?? ""}
        onChange={(e) => set({ project: e.target.value })}
        className={selectClass}
      >
        <option value="">모든 프로젝트</option>
        {filters.data?.projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>

      <select
        aria-label="모델"
        value={values.model ?? ""}
        onChange={(e) => set({ model: e.target.value })}
        className={selectClass}
      >
        <option value="">모든 모델</option>
        {filters.data?.models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>

      {filters.isError && (
        <span className="text-xs text-warn">
          프로젝트·모델 목록을 불러오지 못했습니다
        </span>
      )}

      {filters.data?.lastImportedAt && (
        <span className="ml-auto text-xs text-muted">
          마지막 데이터 반영{" "}
          {formatRelative(filters.data.lastImportedAt, new Date())}
        </span>
      )}
    </div>
  );
}
