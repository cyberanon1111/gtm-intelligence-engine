import type { PrismaClient } from "@/lib/generated/prisma/client";
import { type AIClient, createAnthropicClient } from "@/lib/ai/client";
import { runResearchAgent } from "@/lib/ai/agents/researchAgent";
import { runWhyNowAgent } from "@/lib/ai/agents/whyNowAgent";
import { RESEARCH_PROMPT_VERSION, type ResearchResult } from "@/lib/ai/schemas/research";
import { WHY_NOW_PROMPT_VERSION, type WhyNowResult } from "@/lib/ai/schemas/whyNow";
import { RESEARCH_MODEL } from "@/lib/ai/client";
import { persistEvidence } from "@/lib/research/evidence";
import type { ScoreComponentDetails } from "@/lib/scoring/types";

export interface PipelineResult {
  research: { id: string; status: "COMPLETED" | "FAILED" };
  whyNow: { id: string; status: "COMPLETED" | "FAILED" } | null;
}

// This is the "job" — a plain async function, not tied to any request/queue
// mechanism, so a background worker can call the exact same function later
// without the account page's server action changing at all. Today it runs
// synchronously inside a server action; introducing a queue later means
// wrapping this call, not rewriting it.
export async function runIntelligencePipeline(
  db: PrismaClient,
  accountId: string,
  deps: { aiClient?: AIClient } = {},
): Promise<PipelineResult> {
  const aiClient = deps.aiClient ?? createAnthropicClient();

  const account = await db.account.findUniqueOrThrow({
    where: { id: accountId },
    include: {
      contacts: { include: { persona: true } },
      signals: { orderBy: { detectedAt: "desc" } },
      scores: { orderBy: { computedAt: "desc" }, take: 1 },
    },
  });

  const researchInsight = await db.accountInsight.create({
    data: {
      accountId,
      kind: "RESEARCH",
      status: "PENDING",
      provider: "anthropic",
      model: RESEARCH_MODEL,
      promptVersion: RESEARCH_PROMPT_VERSION,
    },
  });

  let researchResult: ResearchResult;
  try {
    researchResult = await runResearchAgent(aiClient, {
      account,
      contacts: account.contacts,
      signals: account.signals,
      currentScore: account.currentScore,
    });
  } catch (error) {
    await db.accountInsight.update({
      where: { id: researchInsight.id },
      data: { status: "FAILED", error: errorMessage(error) },
    });
    return { research: { id: researchInsight.id, status: "FAILED" }, whyNow: null };
  }

  await db.accountInsight.update({
    where: { id: researchInsight.id },
    data: { status: "COMPLETED", content: researchResult as never, generatedAt: new Date() },
  });
  await persistEvidence(db, {
    accountId,
    insightId: researchInsight.id,
    accountWebsite: account.website,
    items: researchResult.evidence,
  });

  // Why-Now depends on a completed research snapshot — if research failed
  // above we already returned, so by this point we have one to use.
  const latestScore = account.scores[0];
  const [personas, products] = await Promise.all([
    db.persona.findMany({ where: { active: true }, select: { name: true } }),
    db.product.findMany({ where: { active: true }, select: { name: true, description: true } }),
  ]);

  const whyNowInsight = await db.accountInsight.create({
    data: {
      accountId,
      kind: "GTM_INTELLIGENCE",
      status: "PENDING",
      provider: "anthropic",
      model: RESEARCH_MODEL,
      promptVersion: WHY_NOW_PROMPT_VERSION,
    },
  });

  let whyNowResult: WhyNowResult;
  try {
    const componentDetails = latestScore?.componentDetails as unknown as ScoreComponentDetails | undefined;
    whyNowResult = await runWhyNowAgent(aiClient, {
      account,
      score: latestScore
        ? {
            total: latestScore.total,
            icpFit: latestScore.icpFit,
            signalStrength: latestScore.signalStrength,
            problemRelevance: latestScore.problemRelevance,
            buyingPersona: latestScore.buyingPersona,
            engagement: latestScore.engagement,
            matchedProblems: componentDetails?.problemRelevance.matchedProblems ?? [],
            matchedContacts:
              componentDetails?.buyingPersona.matchedContacts.map((c) => ({
                name: c.name,
                personaName: c.personaName,
                seniorityTier: c.seniorityTier,
              })) ?? [],
          }
        : null,
      research: researchResult,
      availablePersonas: personas.map((p) => p.name),
      availableProducts: products,
    });
  } catch (error) {
    await db.accountInsight.update({
      where: { id: whyNowInsight.id },
      data: { status: "FAILED", error: errorMessage(error) },
    });
    return {
      research: { id: researchInsight.id, status: "COMPLETED" },
      whyNow: { id: whyNowInsight.id, status: "FAILED" },
    };
  }

  await db.accountInsight.update({
    where: { id: whyNowInsight.id },
    data: { status: "COMPLETED", content: whyNowResult as never, generatedAt: new Date() },
  });
  await persistEvidence(db, {
    accountId,
    insightId: whyNowInsight.id,
    accountWebsite: account.website,
    items: whyNowResult.supportingEvidence,
  });

  return {
    research: { id: researchInsight.id, status: "COMPLETED" },
    whyNow: { id: whyNowInsight.id, status: "COMPLETED" },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error during research.";
}
