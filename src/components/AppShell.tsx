"use client";

import { useAppMode } from "@/app/providers";
import { api, queryKeys } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { DemoBanner } from "./DemoBanner";
import { GridIcon, ListIcon } from "./icons";
import { SyncButton } from "./SyncButton";

const NAV_ITEMS = [
  { href: "/", label: "대시보드", Icon: GridIcon },
  { href: "/sessions", label: "세션", Icon: ListIcon },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function pageTitle(pathname: string | null): string {
  if (pathname === "/") return "대시보드";
  if (pathname === "/sessions") return "세션";
  return "";
}

function NavLinks({
  pathname,
  layout,
}: {
  pathname: string | null;
  layout: "column" | "row";
}) {
  return (
    <nav
      className={
        layout === "column" ? "grid gap-1" : "flex items-center gap-1 text-sm"
      }
    >
      {NAV_ITEMS.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={
            pathname && isActive(pathname, href) ? "page" : undefined
          }
          className={`flex items-center gap-3 rounded-lg text-muted hover:bg-fill hover:text-fg aria-[current=page]:bg-fg aria-[current=page]:text-bg ${
            layout === "column" ? "px-3 py-2.5" : "px-3 py-1.5"
          }`}
        >
          {layout === "column" && <Icon className="size-4.5" />}
          {label}
        </Link>
      ))}
    </nav>
  );
}

// /sessions/[id]처럼 경로가 요청 때 정해지는 페이지는 빌드 때 pathname을 몰라 Suspense가 필요하다.
function CurrentNavLinks({ layout }: { layout: "column" | "row" }) {
  return <NavLinks pathname={usePathname()} layout={layout} />;
}

// 세션 상세는 세션 제목이 곧 페이지 제목이라 여기서는 아무것도 그리지 않는다.
function CurrentHeading() {
  const title = pageTitle(usePathname());
  if (!title) return null;
  return (
    <h1 className="sr-only text-2xl font-semibold tracking-tight lg:not-sr-only lg:mb-6">
      {title}
    </h1>
  );
}

// 데이터가 언제 반영됐는지는 Sync와 같은 관심사라 버튼 옆에 둔다. 필터 목록과 같은 쿼리라 필터가 있는 화면에서는 요청이 늘지 않는다.
function LastImported({ className = "" }: { className?: string }) {
  const filters = useQuery({
    queryKey: queryKeys.filters,
    queryFn: api.filters,
  });
  const lastImportedAt = filters.data?.lastImportedAt;
  if (!lastImportedAt) return null;
  return (
    <span className={`text-xs text-muted ${className}`}>
      {formatRelative(lastImportedAt, new Date())} 반영
    </span>
  );
}

function Brand() {
  return (
    <Link href="/" className="text-[17px] font-semibold tracking-tight">
      tokentrail
    </Link>
  );
}

// 넓은 화면에서만 보인다. 데이터 상태(반영 시각·Sync)는 화면마다 같아서 사이드바 아래에 둔다.
export function AppSidebar() {
  const mode = useAppMode();
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-line bg-surface px-4 py-6 lg:flex">
      <div className="px-3">
        <Brand />
      </div>
      <Suspense fallback={<NavLinks pathname={null} layout="column" />}>
        <CurrentNavLinks layout="column" />
      </Suspense>
      <div className="mt-auto grid gap-2 px-1">
        <LastImported className="px-2" />
        {mode === "local" && <SyncButton className="w-full" />}
      </div>
    </aside>
  );
}

// 좁은 화면에서만 보인다. 사이드바 대신 브랜드·메뉴·Sync를 한 줄에 둔다.
export function AppTopBar() {
  const mode = useAppMode();
  return (
    <>
      {mode === "demo" && <DemoBanner />}
      <header className="border-b border-line bg-surface lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-8">
          <Brand />
          <Suspense fallback={<NavLinks pathname={null} layout="row" />}>
            <CurrentNavLinks layout="row" />
          </Suspense>
          <div className="ml-auto flex items-center gap-3">
            <LastImported className="hidden sm:inline" />
            {mode === "local" && <SyncButton />}
          </div>
        </div>
      </header>
    </>
  );
}

// 넓은 화면에서만 보이는 페이지 제목. 좁은 화면에서는 상단 바의 선택된 메뉴가 눈에 보이는 제목 역할을 하고, h1은 화면 낭독기용으로만 남긴다.
export function PageHeading() {
  return (
    <Suspense fallback={null}>
      <CurrentHeading />
    </Suspense>
  );
}
