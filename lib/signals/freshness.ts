import { getFreshnessExpectationDays } from "@/config/meridian/signalFreshness";

export type FreshnessLabel = "FRESH" | "AGING" | "STALE";

// Display-only: how a signal's age compares to its category's freshness
// expectation. This is informational (e.g. a UI badge) and has no
// relationship to the scoring engine's own independent decay calculation —
// see config/meridian/signalFreshness.ts for why they're deliberately separate.
export function getSignalFreshnessLabel(
  signal: { category: string; detectedAt: Date },
  now: Date = new Date(),
): FreshnessLabel {
  const expectedDays = getFreshnessExpectationDays(signal.category);
  const ageDays = (now.getTime() - signal.detectedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (ageDays <= expectedDays * 0.5) return "FRESH";
  if (ageDays <= expectedDays) return "AGING";
  return "STALE";
}
