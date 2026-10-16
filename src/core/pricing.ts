import type { Rates } from "./config";

export type TokenCounts = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
};

export function totalTokens(t: TokenCounts): number {
  return (
    t.inputTokens +
    t.outputTokens +
    t.cacheReadTokens +
    t.cacheWrite5mTokens +
    t.cacheWrite1hTokens
  );
}

export function estimateCostUsd(
  tokens: TokenCounts,
  model: string,
  pricing: Record<string, Rates>,
): number | null {
  const modelPrefix = Object.keys(pricing)
    .filter((prefix) => model.startsWith(prefix))
    .sort((a, b) => b.length - a.length)[0];

  if (!modelPrefix) {
    return null;
  }

  const rates = pricing[modelPrefix];
  const cost =
    (tokens.inputTokens / 1_000_000) * rates.input +
    (tokens.outputTokens / 1_000_000) * rates.output +
    (tokens.cacheReadTokens / 1_000_000) * rates.cacheRead +
    (tokens.cacheWrite5mTokens / 1_000_000) * rates.cacheWrite5m +
    (tokens.cacheWrite1hTokens / 1_000_000) * rates.cacheWrite1h;

  return cost;
}
