import type { PrismaClient } from "@/lib/generated/prisma/client";
import { SCORING_ENGINE_VERSION } from "@/lib/scoring/constants";
import { computeIcpFit } from "@/lib/scoring/icpFit";
import { computeSignalStrength } from "@/lib/scoring/signalStrength";
import { computeProblemRelevance } from "@/lib/scoring/problemRelevance";
import { computeBuyingPersona } from "@/lib/scoring/buyingPersona";
import { computeEngagement } from "@/lib/scoring/engagement";
import {
  signalStrengthConfigSchema,
  problemRelevanceConfigSchema,
  buyingPersonaConfigSchema,
  engagementConfigSchema,
} from "@/lib/scoring/configSchemas";
import type { ScoreResult } from "@/lib/scoring/types";

export class ScoringConfigError extends Error {}

// Pure computation: takes a fully-loaded account graph + the active
// configuration rows, returns a ScoreResult. No DB writes here — see
// persist.ts for the side-effecting save. Deterministic in `now`, so tests
// can pin a fixed instant and get reproducible output.
export async function computeAccountScore(
  db: PrismaClient,
  accountId: string,
  now: Date = new Date(),
): Promise<ScoreResult> {
  const [account, icpRules, scoringRules, products] = await Promise.all([
    db.account.findUniqueOrThrow({
      where: { id: accountId },
      include: {
        signals: true,
        contacts: { include: { persona: true } },
        activities: { include: { outcomes: true } },
      },
    }),
    db.iCPRule.findMany({ where: { active: true } }),
    db.scoringRule.findMany({ where: { active: true } }),
    db.product.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);

  const ruleFor = (dimension: string) => scoringRules.find((r) => r.dimension === dimension);

  const signalStrengthRule = ruleFor("SIGNAL_STRENGTH");
  const problemRelevanceRule = ruleFor("PROBLEM_RELEVANCE");
  const buyingPersonaRule = ruleFor("BUYING_PERSONA");
  const engagementRule = ruleFor("ENGAGEMENT");

  if (!signalStrengthRule || !problemRelevanceRule || !buyingPersonaRule || !engagementRule) {
    throw new ScoringConfigError(
      "Missing one or more required ScoringRule rows (SIGNAL_STRENGTH, PROBLEM_RELEVANCE, BUYING_PERSONA, ENGAGEMENT). Run `npm run db:seed`.",
    );
  }

  const signalStrengthConfig = signalStrengthConfigSchema.parse(signalStrengthRule.config);
  const problemRelevanceConfig = problemRelevanceConfigSchema.parse(problemRelevanceRule.config);
  const buyingPersonaConfig = buyingPersonaConfigSchema.parse(buyingPersonaRule.config);
  const engagementConfig = engagementConfigSchema.parse(engagementRule.config);

  const nonEngagementSignals = account.signals.filter((s) => s.category !== "ENGAGEMENT");
  const engagementSignals = account.signals.filter((s) => s.category === "ENGAGEMENT");

  const icpFit = computeIcpFit(account, icpRules);
  const signalStrength = computeSignalStrength(nonEngagementSignals, signalStrengthConfig, now);
  const problemRelevance = computeProblemRelevance(account.signals, problemRelevanceConfig, products);
  const buyingPersona = computeBuyingPersona(account.contacts, buyingPersonaConfig);
  const engagement = computeEngagement(engagementSignals, account.activities, engagementConfig, now);

  const total =
    icpFit.points +
    signalStrength.points +
    problemRelevance.points +
    buyingPersona.points +
    engagement.points;

  return {
    accountId,
    icpFit: icpFit.points,
    signalStrength: signalStrength.points,
    problemRelevance: problemRelevance.points,
    buyingPersona: buyingPersona.points,
    engagement: engagement.points,
    total,
    scoringVersion: SCORING_ENGINE_VERSION,
    componentDetails: {
      icpFit: icpFit.detail,
      signalStrength: signalStrength.detail,
      problemRelevance: problemRelevance.detail,
      buyingPersona: buyingPersona.detail,
      engagement: engagement.detail,
    },
  };
}
