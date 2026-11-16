import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { runResearchWorkflow } from "../lib/research/researchRun";
import { createMockResearchProvider } from "../lib/research-provider/mockProvider";
import type { AIClient } from "../lib/ai/client";
import type { RetrievedDocument } from "../lib/research-provider/types";

after(async () => {
  // Source has no accountId (by design — sources can be shared/reused across
  // accounts), so deleting a test account doesn't cascade-clean the Source
  // rows this file's fixtures create. Sweep them explicitly — by URL prefix
  // for retrieved-document sources, and by name for the VALID_RESEARCH/
  // VALID_WHY_NOW fixtures' url-less evidence sources.
  await prisma.source.deleteMany({ where: { url: { startsWith: "https://example-news.test/" } } });
  await prisma.source.deleteMany({ where: { url: null, name: "Signal record (research-run test)" } });
  await prisma.$disconnect();
});

function queuedClient(responses: (string | Error)[]): AIClient {
  let i = 0;
  return {
    async complete() {
      const next = responses[i++];
      if (next === undefined) throw new Error("queuedClient called more times than responses provided");
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

const FLEET_DOC: RetrievedDocument = {
  url: "https://example-news.test/fleet-expansion-article",
  title: "Test Co announces fleet expansion",
  publisher: "Example Maritime News",
  publishedAt: "2026-03-01T00:00:00.000Z",
  content: "Test Co announced a fleet expansion, adding several vessels to its managed fleet in Q1 2026.",
};

const factExtractionResponse = (statement: string, confidence = 85) =>
  JSON.stringify({ facts: [{ statement, confidence, context: "Q1 2026" }] });

const EMPTY_FACTS = JSON.stringify({ facts: [] });

const VALID_RESEARCH = JSON.stringify({
  companySummary: "Test Co is expanding.",
  fleetProfile: "Growing fleet.",
  recentDevelopments: ["Fleet expansion announced"],
  leadershipChanges: [],
  relevantCompliance: [],
  technologySignals: [],
  evidence: [
    { sourceName: "Signal record (research-run test)", claim: "Fleet is expanding", claimType: "FACT", confidence: 85 },
  ],
});

const VALID_WHY_NOW = JSON.stringify({
  whyNow: "Fleet expansion increases mooring complexity.",
  potentialProblems: [],
  relevantProducts: [],
  relevantPersonas: [],
  recommendedNextStep: "Share a case study.",
  confidence: 50,
  supportingEvidence: [],
});

async function withTestAccount<T>(fn: (accountId: string) => Promise<T>): Promise<T> {
  const account = await prisma.account.create({
    data: { companyName: `Test ResearchRun Account ${Date.now()}-${Math.random()}` },
  });
  try {
    return await fn(account.id);
  } finally {
    await prisma.account.delete({ where: { id: account.id } });
  }
}

test("a successful run persists source, fact, signal, evidence, and recalculates the score", async () => {
  await withTestAccount(async (accountId) => {
    const provider = createMockResearchProvider([FLEET_DOC]);
    const client = queuedClient([
      factExtractionResponse("The company announced a fleet expansion this quarter."),
      VALID_RESEARCH,
      VALID_WHY_NOW,
    ]);

    const run = await runResearchWorkflow(prisma, accountId, { aiClient: client, researchProvider: provider });

    assert.equal(run.status, "COMPLETED");
    assert.equal(run.sourcesFound, 1);
    assert.equal(run.factsExtracted, 1);
    assert.equal(run.signalsDetected, 1);
    assert.equal(run.newSignalIds.length, 1);
    assert.notEqual(run.scoreAfter, null);

    const source = await prisma.source.findFirstOrThrow({ where: { url: FLEET_DOC.url } });
    assert.equal(source.rawContent, FLEET_DOC.content);

    const fact = await prisma.fact.findFirstOrThrow({ where: { accountId, sourceId: source.id } });
    assert.equal(fact.confidence, 85);

    const signal = await prisma.signal.findFirstOrThrow({ where: { id: run.newSignalIds[0] } });
    assert.equal(signal.type, "FLEET_EXPANSION");
    assert.equal(signal.status, "ACTIVE");

    const evidence = await prisma.evidence.findFirstOrThrow({ where: { signalId: signal.id } });
    assert.equal(evidence.sourceId, source.id);
    assert.equal(evidence.factId, fact.id);
    assert.equal(evidence.claimType, "FACT");

    const scores = await prisma.score.findMany({ where: { accountId } });
    assert.equal(scores.length, 1);
  });
});

test("re-running against the same source does not create a duplicate signal", async () => {
  await withTestAccount(async (accountId) => {
    const provider = createMockResearchProvider([FLEET_DOC]);
    const client = queuedClient([
      factExtractionResponse("The company announced a fleet expansion this quarter."),
      VALID_RESEARCH,
      VALID_WHY_NOW,
      factExtractionResponse("The company announced a fleet expansion this quarter, again."),
      VALID_RESEARCH,
      VALID_WHY_NOW,
    ]);

    const first = await runResearchWorkflow(prisma, accountId, { aiClient: client, researchProvider: provider });
    const second = await runResearchWorkflow(prisma, accountId, { aiClient: client, researchProvider: provider });

    assert.equal(first.signalsDetected, 1);
    assert.equal(second.signalsDetected, 0); // deduped — same (accountId, type, sourceId) identity
    assert.equal(second.scoreAfter, second.scoreBefore); // no new signals -> no recalculation

    const signals = await prisma.signal.findMany({ where: { accountId, type: "FLEET_EXPANSION" } });
    assert.equal(signals.length, 1);

    // the same Source row is reused, not duplicated, across both runs
    const sources = await prisma.source.findMany({ where: { url: FLEET_DOC.url } });
    assert.equal(sources.length, 1);
  });
});

test("a fact-extraction failure on one document does not abort the run for other documents", async () => {
  await withTestAccount(async (accountId) => {
    const secondDoc: RetrievedDocument = {
      url: "https://example-news.test/second-article",
      title: "Second article",
      content: "The company is expanding its fleet with new vessels.",
    };
    const provider = createMockResearchProvider([FLEET_DOC, secondDoc]);
    const client = queuedClient([
      new Error("simulated extraction failure"),
      factExtractionResponse("The company is expanding its fleet with new vessels."),
      VALID_RESEARCH,
      VALID_WHY_NOW,
    ]);

    const run = await runResearchWorkflow(prisma, accountId, { aiClient: client, researchProvider: provider });

    assert.equal(run.status, "PARTIAL");
    assert.equal(run.sourcesFound, 2);
    assert.equal(run.factsExtracted, 1); // only the second document's fact
    const errors = run.errors as { step: string; message: string }[];
    assert.ok(errors.some((e) => e.step.includes("fact_extraction") && e.message.includes("simulated extraction failure")));
  });
});

test("with no external provider configured, the run still completes the intelligence pipeline on existing data", async () => {
  await withTestAccount(async (accountId) => {
    const client = queuedClient([VALID_RESEARCH, VALID_WHY_NOW]);

    const run = await runResearchWorkflow(prisma, accountId, { aiClient: client });

    assert.equal(run.status, "PARTIAL");
    assert.equal(run.sourcesFound, 0);
    assert.equal(run.factsExtracted, 0);
    assert.equal(run.signalsDetected, 0);
    assert.notEqual(run.researchInsightId, null);
    assert.notEqual(run.whyNowInsightId, null);
    const errors = run.errors as { step: string; message: string }[];
    assert.ok(errors.some((e) => e.step === "external_retrieval"));
  });
});

test("score before/after are both tracked, and unchanged when no new signals are detected", async () => {
  await withTestAccount(async (accountId) => {
    await prisma.score.create({
      data: {
        accountId,
        icpFit: 5,
        signalStrength: 0,
        problemRelevance: 0,
        buyingPersona: 0,
        engagement: 0,
        total: 5,
        scoringVersion: "v1",
        componentDetails: {},
      },
    });
    await prisma.account.update({ where: { id: accountId }, data: { currentScore: 5 } });

    const client = queuedClient([VALID_RESEARCH, VALID_WHY_NOW]);
    const run = await runResearchWorkflow(prisma, accountId, { aiClient: client });

    assert.equal(run.scoreBefore, 5);
    assert.equal(run.scoreAfter, 5); // no new signals -> no recalculation -> unchanged
  });
});

test("research run history is preserved across multiple runs — never overwritten", async () => {
  await withTestAccount(async (accountId) => {
    const client = queuedClient([
      VALID_RESEARCH,
      VALID_WHY_NOW,
      VALID_RESEARCH,
      VALID_WHY_NOW,
      VALID_RESEARCH,
      VALID_WHY_NOW,
    ]);

    await runResearchWorkflow(prisma, accountId, { aiClient: client });
    await runResearchWorkflow(prisma, accountId, { aiClient: client });
    await runResearchWorkflow(prisma, accountId, { aiClient: client });

    const runs = await prisma.researchRun.findMany({ where: { accountId } });
    assert.equal(runs.length, 3);
  });
});

test("a document producing no extractable facts is a normal (non-error) outcome", async () => {
  await withTestAccount(async (accountId) => {
    const provider = createMockResearchProvider([FLEET_DOC]);
    const client = queuedClient([EMPTY_FACTS, VALID_RESEARCH, VALID_WHY_NOW]);

    const run = await runResearchWorkflow(prisma, accountId, { aiClient: client, researchProvider: provider });

    assert.equal(run.sourcesFound, 1);
    assert.equal(run.factsExtracted, 0);
    assert.equal(run.signalsDetected, 0);
  });
});
