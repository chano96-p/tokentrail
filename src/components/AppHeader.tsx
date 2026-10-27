"use client";

import { useAppMode } from "@/app/providers";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DemoBanner } from "./DemoBanner";
import { SyncButton } from "./SyncButton";

const NAV_ITEMS = [
  { href: "/", label: "대시보드" },
  { href: "/sessions", label: "세션" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppHeader() {
  const mode = useAppMode();
  const pathname = usePathname();

  return (
    <header className="border-b border-line bg-surface">
      {mode === "demo" && <DemoBanner />}
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
        <Link href="/" className="font-mono text-sm font-semibold text-accent">
          tokentrail
        </Link>
        <nav className="flex gap-4 text-sm">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className="text-muted hover:text-fg aria-[current=page]:font-medium aria-[current=page]:text-fg"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">{mode === "local" && <SyncButton />}</div>
      </div>
    </header>
  );
}
