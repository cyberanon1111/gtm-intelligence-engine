import { z } from "zod";
import type { ActivationContext } from "@/lib/activation/context";
import { whyNowResultSchema } from "@/lib/ai/schemas/whyNow";
import { researchResultSchema } from "@/lib/ai/schemas/research";

// Phase 6: what was known at the moment an Activation was generated, frozen
// permanently into Activation.contextSnapshot. Deliberately reuses the
// scoring engine's own componentDetails wholesale rather than re-deriving a
// parallel shape — componentDetails.signalStrength.signals and
// componentDetails.problemRelevance.matchedProblems (with their nested
// relevantProducts) already ARE the "signals" and "relevant problems/product"
// data this snapshot needs, so there's no second source of truth to keep in
// sync. This is captured once, at generation time, and never recomputed or
// refreshed from current records afterward.
const scoreSnapshotSchema = z.object({
  id: z.string(),
  total: z.number(),
  icpFit: z.number(),
  signalStrength: z.number(),
  problemRelevance: z.number(),
  buyingPersona: z.number(),
  engagement: z.number(),
  scoringVersion: z.string(),
  computedAt: z.string(),
  componentDetails: z.unknown(),
});

const contactSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  personaName: z.string().nullable(),
});

const evidenceSnapshotSchema = z.object({
  id: z.string(),
  claim: z.string(),
  claimType: z.string(),
  sourceName: z.string(),
});

export const activationContextSnapshotSchema = z.object({
  capturedAt: z.string(),
  score: scoreSnapshotSchema.nullable(),
  contact: contactSnapshotSchema.nullable(),
  evidence: z.array(evidenceSnapshotSchema),
  whyNow: whyNowResultSchema.nullable(),
  research: researchResultSchema.nullable(),
  sourceInsightId: z.string().nullable(),
});

export type ActivationContextSnapshot = z.infer<typeof activationContextSnapshotSchema>;

// Pure, synchronous — the ActivationContext passed in was already assembled
// (and, for score, already includes the raw DB row) by gatherActivationContext.
export function buildActivationContextSnapshot(
  context: ActivationContext,
  now: Date = new Date(),
): ActivationContextSnapshot {
  return {
    capturedAt: now.toISOString(),
    score: context.rawScore
      ? {
          id: context.rawScore.id,
          total: context.rawScore.total,
          icpFit: context.rawScore.icpFit,
          signalStrength: context.rawScore.signalStrength,
          problemRelevance: context.rawScore.problemRelevance,
          buyingPersona: context.rawScore.buyingPersona,
          engagement: context.rawScore.engagement,
          scoringVersion: context.rawScore.scoringVersion,
          computedAt: context.rawScore.computedAt.toISOString(),
          componentDetails: context.rawScore.componentDetails,
        }
      : null,
    contact: context.contact
      ? {
          id: context.contact.id,
          name: context.contact.name,
          title: context.contact.title,
          personaName: context.contact.persona?.name ?? null,
        }
      : null,
    evidence: context.evidence,
    whyNow: context.whyNow,
    research: context.research,
    sourceInsightId: context.sourceInsightId,
  };
}

// Best-effort, never-throwing read path for a persisted snapshot — used by
// the journey/analytics/review UI, which must all keep working for
// pre-Phase-6 Activation rows that have no snapshot at all (contextSnapshot
// was added as a nullable column), and must never crash on a malformed one.
export function parseActivationContextSnapshot(value: unknown): ActivationContextSnapshot | null {
  if (value === null || value === undefined) return null;
  const parsed = activationContextSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
