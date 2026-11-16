import type { Activity, Outcome, Signal } from "@/lib/generated/prisma/client";
import { ageInDays, decayFactor, isExpired } from "@/lib/scoring/decay";
import { DIMENSION_MAX } from "@/lib/scoring/constants";
import type { EngagementConfig } from "@/lib/scoring/configSchemas";
import type { EngagementDetail } from "@/lib/scoring/types";

export type ActivityWithOutcomes = Activity & { outcomes: Outcome[] };

// engagementSignals must already be filtered to category === "ENGAGEMENT".
// Returns 0 when there is no real engagement signal or outcome — engagement
// is measured from evidenced events, never invented.
export function computeEngagement(
  engagementSignals: Signal[],
  activities: ActivityWithOutcomes[],
  config: EngagementConfig,
  now: Date,
): { points: number; detail: EngagementDetail } {
  const signalContributions = engagementSignals.map((signal) => {
    const basePoints = config.pointsPerSignalType[signal.type] ?? 0;
    const halfLife = signal.decayHalfLifeDays ?? config.defaultDecayHalfLifeDays ?? 60;
    const expired = isExpired(signal, now);
    const decay = expired ? 0 : decayFactor(ageInDays(signal.detectedAt, now), halfLife);
    return {
      signalId: signal.id,
      title: signal.title,
      type: signal.type,
      points: Math.round(basePoints * decay),
    };
  });

  const outcomeContributions = activities.flatMap((activity) =>
    activity.outcomes.map((outcome) => ({
      outcomeId: outcome.id,
      activityId: activity.id,
      type: outcome.type,
      points: config.pointsPerOutcomeType[outcome.type] ?? 0,
    })),
  );

  const bestSignal = [...signalContributions].sort((a, b) => b.points - a.points)[0] ?? null;
  const bestOutcome = [...outcomeContributions].sort((a, b) => b.points - a.points)[0] ?? null;

  const signalPoints = bestSignal?.points ?? 0;
  const outcomePoints = bestOutcome?.points ?? 0;
  const rawPoints = Math.max(signalPoints, outcomePoints);
  const points = Math.min(rawPoints, DIMENSION_MAX.ENGAGEMENT);

  const chosen: EngagementDetail["chosen"] =
    points === 0 ? "none" : outcomePoints >= signalPoints ? "outcome" : "signal";

  return {
    points,
    detail: {
      signalContribution: bestSignal,
      outcomeContribution: bestOutcome,
      chosen,
    },
  };
}
