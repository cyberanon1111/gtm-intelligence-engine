import type { PrismaClient } from "@/lib/generated/prisma/client";
import { isExpired } from "@/lib/scoring/decay";
import { researchResultSchema } from "@/lib/ai/schemas/research";

export interface WhatChangedResult {
  hasComparison: boolean;
  previousRunAt: Date | null;
  latestRunAt: Date | null;
  scoreChange: { before: number | null; after: number | null; delta: number } | null;
  newSignals: { id: string; title: string; type: string }[];
  newlyExpiredSignals: { id: string; title: string }[];
  newResearchFacts: string[];
}

const EMPTY: WhatChangedResult = {
  hasComparison: false,
  previousRunAt: null,
  latestRunAt: null,
  scoreChange: null,
  newSignals: [],
  newlyExpiredSignals: [],
  newResearchFacts: [],
};

// Compares the latest completed/partial research run to the one before it.
// Kept deliberately simple and factual, per the spec: no synthesized
// narrative, just the concrete differences a person can verify.
export async function computeWhatChanged(db: PrismaClient, accountId: string): Promise<WhatChangedResult> {
  const runs = await db.researchRun.findMany({
    where: { accountId, status: { in: ["COMPLETED", "PARTIAL"] } },
    orderBy: { completedAt: "desc" },
    take: 2,
  });

  if (runs.length < 2) {
    return { ...EMPTY, latestRunAt: runs[0]?.completedAt ?? null };
  }

  const [latest, previous] = runs;
  const now = new Date();

  const [newSignals, allSignals] = await Promise.all([
    latest.newSignalIds.length
      ? db.signal.findMany({
          where: { id: { in: latest.newSignalIds } },
          select: { id: true, title: true, type: true },
        })
      : Promise.resolve([]),
    db.signal.findMany({ where: { accountId }, select: { id: true, title: true, expiresAt: true } }),
  ]);

  const previousRunTime = previous.completedAt ?? previous.startedAt;
  const newlyExpiredSignals = allSignals
    .filter((s) => !isExpired({ expiresAt: s.expiresAt }, previousRunTime) && isExpired({ expiresAt: s.expiresAt }, now))
    .map((s) => ({ id: s.id, title: s.title }));

  let newResearchFacts: string[] = [];
  if (latest.researchInsightId && previous.researchInsightId) {
    const [latestInsight, previousInsight] = await Promise.all([
      db.accountInsight.findUnique({ where: { id: latest.researchInsightId } }),
      db.accountInsight.findUnique({ where: { id: previous.researchInsightId } }),
    ]);
    const latestParsed = latestInsight?.content
      ? researchResultSchema.safeParse(latestInsight.content)
      : undefined;
    const previousParsed = previousInsight?.content
      ? researchResultSchema.safeParse(previousInsight.content)
      : undefined;

    if (latestParsed?.success && previousParsed?.success) {
      const previousItems = new Set([
        ...previousParsed.data.recentDevelopments,
        ...previousParsed.data.leadershipChanges,
        ...previousParsed.data.relevantCompliance,
        ...previousParsed.data.technologySignals,
      ]);
      const latestItems = [
        ...latestParsed.data.recentDevelopments,
        ...latestParsed.data.leadershipChanges,
        ...latestParsed.data.relevantCompliance,
        ...latestParsed.data.technologySignals,
      ];
      newResearchFacts = latestItems.filter((item) => !previousItems.has(item));
    }
  }

  const before = latest.scoreBefore;
  const after = latest.scoreAfter;

  return {
    hasComparison: true,
    previousRunAt: previousRunTime,
    latestRunAt: latest.completedAt,
    scoreChange: before !== null && after !== null ? { before, after, delta: after - before } : null,
    newSignals,
    newlyExpiredSignals,
    newResearchFacts,
  };
}
