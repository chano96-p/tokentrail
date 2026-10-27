"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

// 필터는 URL에 둔다. 새로고침·공유해도 같은 화면이 나오고, 값 그대로 queryKey가 된다.
export function useUrlFilters(): {
  values: Record<string, string>;
  set: (patch: Record<string, string | null>) => void;
} {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const values = useMemo(
    () => Object.fromEntries(searchParams.entries()),
    [searchParams],
  );

  const set = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [searchParams, pathname, router],
  );

  return { values, set };
}
