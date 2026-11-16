import type { PrismaClient } from "@/lib/generated/prisma/client";
import { RESEARCH_FRESHNESS_WINDOW_HOURS } from "@/config/meridian/researchProvider";

export interface FreshnessCheck {
  fresh: boolean;
  lastRunAt: Date | null;
  ageHours: number | null;
  windowHours: number;
}

// "Sufficiently fresh" = a COMPLETED, PARTIAL, or SKIPPED run finished within
// the configured window. A FAILED/PENDING run never counts as fresh — it
// didn't actually produce anything to be fresh about, so a retry should be
// allowed immediately.
export async function checkResearchFreshness(
  db: PrismaClient,
  accountId: string,
  windowHours: number = RESEARCH_FRESHNESS_WINDOW_HOURS,
): Promise<FreshnessCheck> {
  const lastRun = await db.researchRun.findFirst({
    where: { accountId, status: { in: ["COMPLETED", "PARTIAL", "SKIPPED"] } },
    orderBy: { completedAt: "desc" },
  });

  if (!lastRun || !lastRun.completedAt) {
    return { fresh: false, lastRunAt: null, ageHours: null, windowHours };
  }

  const ageHours = (Date.now() - lastRun.completedAt.getTime()) / (1000 * 60 * 60);
  return { fresh: ageHours < windowHours, lastRunAt: lastRun.completedAt, ageHours, windowHours };
}
