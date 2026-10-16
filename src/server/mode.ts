export type AppMode = "local" | "demo";

export function getAppMode(): AppMode {
  const mode = process.env.APP_MODE;

  if (mode === "demo") {
    return "demo";
  } else {
    return "local";
  }
}
