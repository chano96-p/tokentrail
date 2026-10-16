export type AppMode = "local" | "demo";

export function getAppMode(): AppMode {
  const mode = process.env.APP_MODE;

  if (mode === undefined || mode === "" || mode === "local") return "local";
  if (mode === "demo") return "demo";
  throw new Error(`APP_MODE는 local | demo 중 하나여야 합니다: ${mode}`);
}
