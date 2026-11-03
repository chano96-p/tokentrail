import { loadConfig } from "@/core/config";
import { getAppMode } from "@/server/mode";
import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

// Pretendard는 Google Fonts에 없어 npm 패키지의 가변 폰트 파일을 직접 불러온다.
// 한글 전체가 든 파일(약 2MB)이라 preload하지 않는다.
const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // 링크 미리보기 이미지(opengraph-image)는 절대 URL이 필요해 데모 주소를 기준으로 둔다.
  metadataBase: new URL("https://tokentrail-demo.vercel.app"),
  title: "씀씀이",
  description: "Claude Code 토큰 사용량 대시보드와 세션 타임라인",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const config = loadConfig();
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${jetbrainsMono.variable} h-full antialiased`}
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
