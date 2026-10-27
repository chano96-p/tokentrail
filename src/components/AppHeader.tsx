"use client";

import { useAppMode } from "@/app/providers";
import { api, queryKeys } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { DemoBanner } from "./DemoBanner";
import { SyncButton } from "./SyncButton";

const NAV_ITEMS = [
  { href: "/", label: "대시보드" },
  { href: "/sessions", label: "세션" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex gap-4 text-sm">
      {NAV_ITEMS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={
            pathname && isActive(pathname, href) ? "page" : undefined
          }
          className="text-muted hover:text-fg aria-[current=page]:font-medium aria-[current=page]:text-fg"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function CurrentNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

// 데이터가 언제 반영됐는지는 Sync와 같은 관심사라 버튼 옆에 둔다. 필터 목록과 같은 쿼리라 필터가 있는 화면에서는 요청이 늘지 않는다.
function LastImported() {
  const filters = useQuery({
    queryKey: queryKeys.filters,
    queryFn: api.filters,
  });
  const lastImportedAt = filters.data?.lastImportedAt;
  if (!lastImportedAt) return null;
  return (
    <span className="hidden text-xs text-muted sm:inline">
      {formatRelative(lastImportedAt, new Date())} 반영
    </span>
  );
}

export function AppHeader() {
  const mode = useAppMode();

  return (
    <header className="border-b border-line">
      {mode === "demo" && <DemoBanner />}
      <div className="mx-auto flex max-w-7xl items-center gap-8 px-4 py-3 sm:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          tokentrail
        </Link>
        {/* /sessions/[id]처럼 경로가 요청 때 정해지는 페이지는 빌드 때 pathname을 몰라 Suspense가 필요하다. */}
        <Suspense fallback={<NavLinks pathname={null} />}>
          <CurrentNavLinks />
        </Suspense>
        <div className="ml-auto flex items-center gap-3">
          <LastImported />
          {mode === "local" && <SyncButton />}
        </div>
      </div>
    </header>
  );
}
