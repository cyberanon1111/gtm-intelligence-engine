"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runResearchWorkflow } from "@/lib/research/researchRun";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface ResearchRunSummary {
  status: string;
  sourcesFound: number;
  factsExtracted: number;
  signalsDetected: number;
  scoreBefore: number | null;
  scoreAfter: number | null;
}

// Explicitly user-triggered only (a button click) — nothing in this codebase
// calls this on a schedule or automatically for every account. Runs the full
// SOURCE -> FACT -> SIGNAL -> SCORE -> INTELLIGENCE workflow
// (lib/research/researchRun.ts), which itself reuses (not duplicates) the
// Phase 4 research/why-now pipeline.
//
// `force`: "Research Account" (no prior research) passes false — there's
// nothing to be fresh against, so it always proceeds. "Refresh Research"
// (research already exists) passes true, which is the ONLY way to bypass the
// freshness window per the Phase 4.75 spec — without it, research run within
// the window is a no-op SKIPPED row, not a wasted external call.
export async function researchAccountAction(
  accountId: string,
  force: boolean,
): Promise<ActionResult<ResearchRunSummary>> {
  let run;
  try {
    run = await runResearchWorkflow(prisma, accountId, {}, { force });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Research failed unexpectedly.",
    };
  }

  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/signals");
  revalidatePath("/opportunities");

  const summary: ResearchRunSummary = {
    status: run.status,
    sourcesFound: run.sourcesFound,
    factsExtracted: run.factsExtracted,
    signalsDetected: run.signalsDetected,
    scoreBefore: run.scoreBefore,
    scoreAfter: run.scoreAfter,
  };

  if (run.status === "FAILED") {
    return { success: false, error: "Research failed. See Research History below for details." };
  }

  return { success: true, data: summary };
}
