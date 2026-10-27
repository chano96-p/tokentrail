"use client";

import { useSync } from "@/lib/useSync";
import type { AppMode } from "@/server/mode";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";

const AppModeContext = createContext<AppMode>("local");

export function useAppMode(): AppMode {
  return useContext(AppModeContext);
}

// 시각은 브라우저가 아니라 설정 파일의 timezone으로 보여준다. 서버 집계의 날짜 경계와 맞추기 위해서다.
const TimeZoneContext = createContext("UTC");

export function useTimeZone(): string {
  return useContext(TimeZoneContext);
}

function AutoSync() {
  const { mutate } = useSync({ quietWhenUnchanged: true });
  // 개발 모드의 StrictMode는 effect를 두 번 실행한다. 첫 로드에 한 번만 sync한다.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mutate();
  }, [mutate]);
  return null;
}

export function Providers({
  mode,
  autoSync,
  timeZone,
  children,
}: {
  mode: AppMode;
  autoSync: boolean;
  timeZone: string;
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000 } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AppModeContext value={mode}>
        <TimeZoneContext value={timeZone}>
          {mode === "local" && autoSync && <AutoSync />}
          {children}
        </TimeZoneContext>
      </AppModeContext>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}
