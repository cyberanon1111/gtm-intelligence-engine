import type { PrismaClient, Account, Contact, Persona, Score } from "@/lib/generated/prisma/client";
import { researchResultSchema, type ResearchResult } from "@/lib/ai/schemas/research";
import { whyNowResultSchema, type WhyNowResult } from "@/lib/ai/schemas/whyNow";
import type { ActivationEvidenceRef, ActivationScoreContext } from "@/lib/ai/prompts/activation";
import type { ScoreComponentDetails } from "@/lib/scoring/types";

export class InsufficientActivationContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientActivationContextError";
  }
}

export interface ActivationContext {
  account: Pick<Account, "id" | "companyName" | "companyType" | "country" | "fleetSize" | "status" | "website">;
  contact: (Contact & { persona: Persona | null }) | null;
  score: ActivationScoreContext | null;
  // The full Score row behind `score` above — `score` is the reduced shape
  // the prompt needs; `rawScore` is what Phase 6's context snapshot freezes,
  // since componentDetails already carries the contributing signals and
  // matched problems/products (see lib/activation/snapshot.ts).
  rawScore: Score | null;
  whyNow: WhyNowResult | null;
  research: ResearchResult | null;
  evidence: ActivationEvidenceRef[];
  sourceInsightId: string | null;
}

// Assembles everything the Activation Agent (and the review UI) needs, and
// enforces the hard precondition the spec calls out explicitly: an
// activation is never generated from the account name alone. If the account
// has no score, no completed Why-Now intelligence, AND no evidence at all,
// this throws rather than letting generation proceed on nothing.
export async function gatherActivationContext(
  db: PrismaClient,
  accountId: string,
  contactId?: string | null,
): Promise<ActivationContext> {
  const account = await db.account.findUniqueOrThrow({ where: { id: accountId } });
  const contact = contactId
    ? await db.contact.findUniqueOrThrow({ where: { id: contactId }, include: { persona: true } })
    : null;

  const [latestScore, insights, evidenceRows] = await Promise.all([
    db.score.findFirst({ where: { accountId }, orderBy: { computedAt: "desc" } }),
    db.accountInsight.findMany({ where: { accountId }, orderBy: { generatedAt: "desc" } }),
    db.evidence.findMany({
      where: { accountId },
      include: { source: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const latestResearchInsight = insights.find((i) => i.kind === "RESEARCH" && i.status === "COMPLETED");
  const latestWhyNowInsight = insights.find((i) => i.kind === "GTM_INTELLIGENCE" && i.status === "COMPLETED");

  const researchParsed = latestResearchInsight?.content
    ? researchResultSchema.safeParse(latestResearchInsight.content)
    : undefined;
  const whyNowParsed = latestWhyNowInsight?.content
    ? whyNowResultSchema.safeParse(latestWhyNowInsight.content)
    : undefined;

  if (!latestScore && !whyNowParsed?.success && evidenceRows.length === 0) {
    throw new InsufficientActivationContextError(
      "Cannot generate an activation for this account: no score, no completed Why-Now intelligence, and no evidence exist yet. Run scoring and/or research first.",
    );
  }

  const componentDetails = latestScore?.componentDetails as unknown as ScoreComponentDetails | undefined;

  return {
    account,
    contact,
    rawScore: latestScore ?? null,
    score: latestScore
      ? {
          total: latestScore.total,
          matchedProblems:
            componentDetails?.problemRelevance?.matchedProblems?.map((p) => ({
              problemKey: p.problemKey,
              label: p.label,
              relevantProducts: p.relevantProducts,
            })) ?? [],
        }
      : null,
    whyNow: whyNowParsed?.success ? whyNowParsed.data : null,
    research: researchParsed?.success ? researchParsed.data : null,
    evidence: evidenceRows.map((e) => ({
      id: e.id,
      claim: e.claim,
      claimType: e.claimType,
      sourceName: e.source.name,
    })),
    sourceInsightId: latestWhyNowInsight?.id ?? null,
  };
}
