import { z } from "zod";

// Validates the Json `config` column on each ScoringRule row before the
// engine trusts it — a malformed seed/edit should fail loudly, not silently
// miscompute a score.

export const signalStrengthConfigSchema = z.object({
  pointsPerCategory: z.record(z.string(), z.number()),
  maxSignalsCounted: z.number().int().positive(),
  defaultDecayHalfLifeDays: z.number().positive(),
});
export type SignalStrengthConfig = z.infer<typeof signalStrengthConfigSchema>;

export const problemRelevanceConfigSchema = z.object({
  pointsPerMatchedProblem: z.number().nonnegative(),
  maxMatches: z.number().int().positive(),
});
export type ProblemRelevanceConfig = z.infer<typeof problemRelevanceConfigSchema>;

export const buyingPersonaConfigSchema = z.object({
  pointsBySeniorityTier: z.record(z.string(), z.number()),
  relevantPersonaNames: z.array(z.string()),
});
export type BuyingPersonaConfig = z.infer<typeof buyingPersonaConfigSchema>;

export const engagementConfigSchema = z.object({
  pointsPerSignalType: z.record(z.string(), z.number()),
  pointsPerOutcomeType: z.record(z.string(), z.number()),
  aggregation: z.enum(["max", "sum"]).default("max"),
  defaultDecayHalfLifeDays: z.number().positive().optional(),
});
export type EngagementConfig = z.infer<typeof engagementConfigSchema>;
