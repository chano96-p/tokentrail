import { loadConfig } from "@/core/config";
import { getAppMode } from "@/server/mode";
import type { Metadata } from "next";
import { IBM_Plex_Sans_KR, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// 한글 글리프는 subsets에 없어 미리 불러오지 않고, 필요한 글자 범위만 그때 받는다.
const plexSansKr = IBM_Plex_Sans_KR({
  variable: "--font-plex-sans-kr",
  weight: ["400", "500", "700"],
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "tokentrail",
  description: "Claude Code 세션 로그로 보는 토큰 사용량과 세션 타임라인",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const config = loadConfig();
  return (
    <html
      lang="ko"
      className={`${plexSansKr.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers
          mode={getAppMode()}
          autoSync={config.autoSyncOnLoad}
          timeZone={config.timezone}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
