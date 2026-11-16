// Freshness EXPECTATIONS per signal category — how long a signal in this
// category is expected to stay relevant before it's considered "aging".
// This is reference/display metadata only (used by lib/signals/freshness.ts
// for UI badges). It is NOT read by the scoring engine, by design: Phase 3's
// decay math (lib/scoring/decay.ts) is driven entirely by each Signal's own
// `decayHalfLifeDays`/`expiresAt`, independently of this config. Changing
// this file never changes a score.

export const SIGNAL_CATEGORY_FRESHNESS_DAYS: Record<string, number> = {
  GROWTH: 120,
  PEOPLE: 180,
  COMPLIANCE: 90,
  TECHNOLOGY: 150,
  ENGAGEMENT: 30,
};

export const DEFAULT_FRESHNESS_DAYS = 120;

export function getFreshnessExpectationDays(category: string): number {
  return SIGNAL_CATEGORY_FRESHNESS_DAYS[category] ?? DEFAULT_FRESHNESS_DAYS;
}
