import type { PrismaClient, ResearchRun } from "@/lib/generated/prisma/client";
import { type AIClient, createAnthropicClient } from "@/lib/ai/client";
import type { ResearchProvider, RetrievedDocument } from "@/lib/research-provider/types";
import { createConfiguredResearchProvider } from "@/lib/research-provider/factory";
import { ingestDocument, inferSourceType } from "@/lib/research/sourceIngestion";
import { detectSignalCandidates, isDuplicateSignal, createSignalFromFact } from "@/lib/research/signalDetection";
import { computeAndSaveAccountScore } from "@/lib/scoring/persist";
import { runIntelligencePipeline } from "@/lib/research/pipeline";
import { checkResearchFreshness } from "@/lib/research/freshness";
import { classifySourceQuality, type SourceQualityValue } from "@/config/meridian/sourceQuality";
import { RESEARCH_PROVIDER_LIMITS, RESEARCH_FRESHNESS_WINDOW_HOURS } from "@/config/meridian/researchProvider";

export interface ResearchRunStepError {
  step: string;
  message: string;
}

export interface ResearchWorkflowDeps {
  aiClient?: AIClient;
  researchProvider?: ResearchProvider;
  /** Skip the freshness check regardless of `force` — used by tests to pin a window. */
  freshnessWindowHours?: number;
}

export interface ResearchWorkflowOptions {
  /** "Refresh Research" always passes true — bypasses the freshness cache unconditionally. */
  force?: boolean;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

// Authoritative sources are processed (and survive the maxDocumentsPerRun
// cap) preferentially — official/primary first, then recognized industry
// publications, then everything else, in the order the provider returned
// them within each tier.
const QUALITY_RANK: Record<SourceQualityValue, number> = {
  OFFICIAL_PRIMARY: 0,
  INDUSTRY_PUBLICATION: 1,
  SECONDARY: 2,
  UNKNOWN: 3,
};

function prioritizeDocuments(documents: RetrievedDocument[], accountWebsite: string | null): RetrievedDocument[] {
  return [...documents]
    .map((doc, index) => ({
      doc,
      index,
      quality: classifySourceQuality(inferSourceType(doc.url, accountWebsite), doc.url),
    }))
    .sort((a, b) => QUALITY_RANK[a.quality] - QUALITY_RANK[b.quality] || a.index - b.index)
    .map((entry) => entry.doc);
}

// Orchestrates the full SOURCE -> FACT -> SIGNAL -> SCORE -> INTELLIGENCE
// pipeline for one account: a freshness check (skip if recent research
// already exists, unless explicitly forced), external retrieval (via
// whichever ResearchProvider is configured), fact extraction, deterministic
// signal detection + dedup, explicit score recalculation (only if new
// signals were actually created), then the existing Phase 4 research/why-now
// pipeline (reused, not duplicated). Every step is independently
// fault-tolerant — a failure in one is recorded and the run continues, never
// corrupting prior data. Returns the persisted ResearchRun row, which is the
// durable history record (never overwritten; every call creates a new row).
export async function runResearchWorkflow(
  db: PrismaClient,
  accountId: string,
  deps: ResearchWorkflowDeps = {},
  options: ResearchWorkflowOptions = {},
): Promise<ResearchRun> {
  const aiClient = deps.aiClient ?? createAnthropicClient();
  const researchProvider = deps.researchProvider ?? createConfiguredResearchProvider();

  const account = await db.account.findUniqueOrThrow({ where: { id: accountId } });
  const scoreBefore = account.currentScore;

  if (!options.force) {
    const freshness = await checkResearchFreshness(
      db,
      accountId,
      deps.freshnessWindowHours ?? RESEARCH_FRESHNESS_WINDOW_HOURS,
    );
    if (freshness.fresh) {
      return db.researchRun.create({
        data: {
          accountId,
          status: "SKIPPED",
          startedAt: new Date(),
          completedAt: new Date(),
          scoreBefore,
          scoreAfter: scoreBefore,
          errors: [
            {
              step: "freshness_check",
              message: `Skipped — existing research from ${freshness.lastRunAt?.toISOString()} is still within the ${freshness.windowHours}h freshness window. Click "Refresh Research" to force a new run.`,
            },
          ] as never,
        },
      });
    }
  }

  const run = await db.researchRun.create({
    data: { accountId, status: "PENDING", scoreBefore },
  });

  const errors: ResearchRunStepError[] = [];
  let sourcesFound = 0;
  let factsExtracted = 0;
  const newSignalIds: string[] = [];

  let documents: RetrievedDocument[] = [];
  try {
    const retrieved = await researchProvider.search({
      companyName: account.companyName,
      website: account.website,
    });
    documents = prioritizeDocuments(retrieved, account.website).slice(
      0,
      RESEARCH_PROVIDER_LIMITS.maxDocumentsPerRun,
    );
    sourcesFound = documents.length;
  } catch (error) {
    errors.push({ step: "external_retrieval", message: errorMessage(error) });
  }

  for (const document of documents) {
    let sourceId: string;
    let factIds: string[];
    try {
      const ingested = await ingestDocument(db, aiClient, {
        accountId,
        accountCompanyName: account.companyName,
        accountWebsite: account.website,
        document,
      });
      sourceId = ingested.source.id;
      factIds = ingested.factIds;
      factsExtracted += factIds.length;
    } catch (error) {
      errors.push({ step: `fact_extraction:${document.url}`, message: errorMessage(error) });
      continue;
    }

    if (factIds.length === 0) continue;
    const facts = await db.fact.findMany({ where: { id: { in: factIds } } });
    const detectedAt = document.publishedAt ? new Date(document.publishedAt) : new Date();

    for (const fact of facts) {
      const candidates = detectSignalCandidates(fact);
      for (const rule of candidates) {
        const duplicate = await isDuplicateSignal(db, { accountId, type: rule.signalType, sourceId });
        if (duplicate) continue;

        const signal = await createSignalFromFact(db, {
          accountId,
          sourceId,
          factId: fact.id,
          detectedAt,
          rule,
          fact,
        });
        newSignalIds.push(signal.id);
      }
    }
  }

  let scoreAfter = scoreBefore;
  if (newSignalIds.length > 0) {
    try {
      const score = await computeAndSaveAccountScore(db, accountId);
      scoreAfter = score.total;
    } catch (error) {
      errors.push({ step: "score_recalculation", message: errorMessage(error) });
    }
  }

  let researchInsightId: string | undefined;
  let whyNowInsightId: string | undefined;
  try {
    const pipelineResult = await runIntelligencePipeline(db, accountId, { aiClient });
    researchInsightId = pipelineResult.research.id;
    if (pipelineResult.research.status === "FAILED") {
      errors.push({ step: "research_agent", message: "Research agent failed — see AccountInsight.error." });
    }
    whyNowInsightId = pipelineResult.whyNow?.id;
    if (pipelineResult.whyNow?.status === "FAILED") {
      errors.push({ step: "why_now_agent", message: "Why-Now agent failed — see AccountInsight.error." });
    }
  } catch (error) {
    errors.push({ step: "intelligence_pipeline", message: errorMessage(error) });
  }

  const producedSomething =
    sourcesFound > 0 || factsExtracted > 0 || newSignalIds.length > 0 || !!researchInsightId;
  const status = errors.length === 0 ? "COMPLETED" : producedSomething ? "PARTIAL" : "FAILED";

  return db.researchRun.update({
    where: { id: run.id },
    data: {
      status,
      completedAt: new Date(),
      sourcesFound,
      factsExtracted,
      signalsDetected: newSignalIds.length,
      newSignalIds,
      scoreAfter,
      researchInsightId,
      whyNowInsightId,
      errors: errors.length > 0 ? (errors as never) : undefined,
    },
  });
}
