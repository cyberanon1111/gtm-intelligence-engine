import type { PrismaClient } from "@/lib/generated/prisma/client";
import { computeAccountScore } from "@/lib/scoring/engine";

// Always creates a new Score row (score history is preserved — Score has no
// unique constraint on accountId by design) and refreshes the Account's
// denormalized icpScore/currentScore cache used for fast list/dashboard
// sorting. The two writes happen in one transaction so the cache never
// drifts from the latest Score row.
export async function computeAndSaveAccountScore(
  db: PrismaClient,
  accountId: string,
  now: Date = new Date(),
) {
  const result = await computeAccountScore(db, accountId, now);

  return db.$transaction(async (tx) => {
    const score = await tx.score.create({
      data: {
        accountId: result.accountId,
        icpFit: result.icpFit,
        signalStrength: result.signalStrength,
        problemRelevance: result.problemRelevance,
        buyingPersona: result.buyingPersona,
        engagement: result.engagement,
        total: result.total,
        scoringVersion: result.scoringVersion,
        componentDetails: result.componentDetails as never,
        computedAt: now,
      },
    });

    await tx.account.update({
      where: { id: accountId },
      data: { icpScore: result.icpFit, currentScore: result.total },
    });

    return score;
  });
}
