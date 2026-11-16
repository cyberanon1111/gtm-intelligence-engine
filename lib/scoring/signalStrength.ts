import type { Signal } from "@/lib/generated/prisma/client";
import { ageInDays, decayFactor, isExpired } from "@/lib/scoring/decay";
import { DIMENSION_MAX } from "@/lib/scoring/constants";
import type { SignalStrengthConfig } from "@/lib/scoring/configSchemas";
import type { SignalContribution, SignalStrengthDetail } from "@/lib/scoring/types";

// signals passed in should already exclude ENGAGEMENT-category signals —
// those are scored separately under the Engagement dimension.
export function computeSignalStrength(
  signals: Signal[],
  config: SignalStrengthConfig,
  now: Date,
): { points: number; detail: SignalStrengthDetail } {
  const contributions: Omit<SignalContribution, "counted">[] = signals.map((signal) => {
    const basePoints = config.pointsPerCategory[signal.category] ?? 0;
    const expired = isExpired(signal, now);
    const age = ageInDays(signal.detectedAt, now);
    const halfLife = signal.decayHalfLifeDays ?? config.defaultDecayHalfLifeDays;
    const decay = expired ? 0 : decayFactor(age, halfLife);
    const confidenceFactor = signal.confidence / 100;
    const strengthFactor = signal.strength / 5;
    const effectivePoints = basePoints * decay * confidenceFactor * strengthFactor;

    return {
      signalId: signal.id,
      title: signal.title,
      category: signal.category,
      type: signal.type,
      basePoints,
      decayFactor: decay,
      ageDays: Math.round(age),
      effectivePoints,
      expired,
    };
  });

  const ranked = [...contributions].sort((a, b) => b.effectivePoints - a.effectivePoints);
  const countedIds = new Set(
    ranked
      .filter((c) => c.effectivePoints > 0)
      .slice(0, config.maxSignalsCounted)
      .map((c) => c.signalId),
  );

  const rawTotal = contributions
    .filter((c) => countedIds.has(c.signalId))
    .reduce((sum, c) => sum + c.effectivePoints, 0);

  const points = Math.min(Math.round(rawTotal), DIMENSION_MAX.SIGNAL_STRENGTH);

  const detail: SignalStrengthDetail = {
    signals: contributions.map((c) => ({ ...c, counted: countedIds.has(c.signalId) })),
  };

  return { points, detail };
}
