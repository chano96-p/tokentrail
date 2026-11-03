import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "씀씀이 · Claude Code 토큰 사용량 대시보드";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ImageResponse는 woff2를 읽지 못해, 같은 패키지의 정적 otf를 쓴다.
const fontDir = join(
  process.cwd(),
  "node_modules/pretendard/dist/public/static",
);
const [bold, regular] = await Promise.all([
  readFile(join(fontDir, "Pretendard-Bold.otf")),
  readFile(join(fontDir, "Pretendard-Regular.otf")),
]);

// 파비콘(icon.svg)과 같은 막대: 토큰 4종 색(cache read, cache write, input, output)
const BARS = [
  { height: 100, color: "#1baf7a" },
  { height: 160, color: "#2a78d6" },
  { height: 130, color: "#eda100" },
  { height: 200, color: "#e34948" },
];

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "#1c1d21",
        color: "#f4f4f5",
        fontFamily: "Pretendard",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
        {BARS.map((bar) => (
          <div
            key={bar.color}
            style={{
              width: 40,
              height: bar.height,
              borderRadius: 8,
              background: bar.color,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: -4 }}>
          씀씀이
        </div>
        <div style={{ fontSize: 40, color: "#a1a1aa" }}>
          Claude Code 토큰 사용량 대시보드와 세션 타임라인
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Pretendard", data: bold, style: "normal", weight: 700 },
        { name: "Pretendard", data: regular, style: "normal", weight: 400 },
      ],
    },
  );
}
