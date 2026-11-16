import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { runIntelligencePipeline } from "../lib/research/pipeline";
import type { AIClient } from "../lib/ai/client";

after(async () => {
  // Source has no accountId, so deleting a test account doesn't cascade-clean
  // the Source rows this file's fixtures create (they're url: null, name-only).
  await prisma.source.deleteMany({
    where: { url: null, name: { in: ["Account record", "Analyst note", "Deterministic score"] } },
  });
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

const VALID_RESEARCH = JSON.stringify({
  companySummary: "Test Co is a bulk carrier owner.",
  fleetProfile: "Operates a small bulk carrier fleet.",
  recentDevelopments: ["Announced fleet expansion"],
  leadershipChanges: [],
  relevantCompliance: [],
  technologySignals: [],
  evidence: [
    { sourceName: "Account record", claim: "Fleet is expanding", claimType: "FACT", confidence: 90 },
    { sourceName: "Analyst note", claim: "Expansion suggests growing operational complexity", claimType: "INFERENCE", confidence: 60 },
  ],
});

const EMPTY_RESEARCH = JSON.stringify({
  companySummary: "UNKNOWN",
  fleetProfile: "UNKNOWN",
  recentDevelopments: [],
  leadershipChanges: [],
  relevantCompliance: [],
  technologySignals: [],
  evidence: [],
});

const VALID_WHY_NOW = JSON.stringify({
  whyNow: "Fleet expansion increases mooring management complexity.",
  potentialProblems: [],
  relevantProducts: [{ productName: "MoorSense M4", rationale: "Addresses mooring complexity." }],
  relevantPersonas: [],
  recommendedNextStep: "Share a case study.",
  confidence: 55,
  supportingEvidence: [
    { sourceName: "Deterministic score", claim: "Account has not been scored yet", claimType: "INFERENCE", confidence: 50 },
  ],
});

async function withTestAccount<T>(fn: (accountId: string) => Promise<T>): Promise<T> {
  const account = await prisma.account.create({
    data: { companyName: `Test Pipeline Account ${Date.now()}-${Math.random()}` },
  });
  try {
    return await fn(account.id);
  } finally {
    await prisma.account.delete({ where: { id: account.id } });
  }
}

test("a successful run creates COMPLETED research + why-now insights with associated evidence", async () => {
  await withTestAccount(async (accountId) => {
    const client = queuedClient([VALID_RESEARCH, VALID_WHY_NOW]);
    const result = await runIntelligencePipeline(prisma, accountId, { aiClient: client });

    assert.equal(result.research.status, "COMPLETED");
    assert.equal(result.whyNow?.status, "COMPLETED");

    const evidenceRows = await prisma.evidence.findMany({ where: { insightId: result.research.id } });
    assert.equal(evidenceRows.length, 2);
    const claimTypes = evidenceRows.map((e) => e.claimType).sort();
    assert.deepEqual(claimTypes, ["FACT", "INFERENCE"]);
  });
});

test("an empty (all-UNKNOWN) research result is a valid COMPLETED run, not an error", async () => {
  await withTestAccount(async (accountId) => {
    const client = queuedClient([EMPTY_RESEARCH, VALID_WHY_NOW]);
    const result = await runIntelligencePipeline(prisma, accountId, { aiClient: client });

    assert.equal(result.research.status, "COMPLETED");
    const insight = await prisma.accountInsight.findUniqueOrThrow({ where: { id: result.research.id } });
    assert.equal((insight.content as { companySummary: string }).companySummary, "UNKNOWN");

    const evidenceRows = await prisma.evidence.findMany({ where: { insightId: result.research.id } });
    assert.equal(evidenceRows.length, 0);
  });
});

test("a research API failure creates a FAILED insight and never attempts why-now", async () => {
  await withTestAccount(async (accountId) => {
    const client = queuedClient([new Error("simulated API failure")]);
    const result = await runIntelligencePipeline(prisma, accountId, { aiClient: client });

    assert.equal(result.research.status, "FAILED");
    assert.equal(result.whyNow, null);

    const insight = await prisma.accountInsight.findUniqueOrThrow({ where: { id: result.research.id } });
    assert.equal(insight.content, null);
    assert.match(insight.error ?? "", /simulated API failure/);

    const whyNowInsights = await prisma.accountInsight.findMany({
      where: { accountId, kind: "GTM_INTELLIGENCE" },
    });
    assert.equal(whyNowInsights.length, 0);
  });
});

test("malformed AI JSON produces a FAILED insight, not a crash or corrupted content", async () => {
  await withTestAccount(async (accountId) => {
    const client = queuedClient(["this is not json"]);
    const result = await runIntelligencePipeline(prisma, accountId, { aiClient: client });
    assert.equal(result.research.status, "FAILED");
  });
});

test("a why-now failure still preserves the completed research snapshot", async () => {
  await withTestAccount(async (accountId) => {
    const client = queuedClient([VALID_RESEARCH, new Error("why-now failed")]);
    const result = await runIntelligencePipeline(prisma, accountId, { aiClient: client });

    assert.equal(result.research.status, "COMPLETED");
    assert.equal(result.whyNow?.status, "FAILED");
  });
});

test("research failures do not corrupt the account's own fields", async () => {
  await withTestAccount(async (accountId) => {
    const before = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    const client = queuedClient([new Error("simulated API failure")]);
    await runIntelligencePipeline(prisma, accountId, { aiClient: client });
    const after = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    assert.deepEqual(before, after);
  });
});

test("running the pipeline twice preserves history — two runs, four insights, nothing overwritten", async () => {
  await withTestAccount(async (accountId) => {
    const client = queuedClient([VALID_RESEARCH, VALID_WHY_NOW, VALID_RESEARCH, VALID_WHY_NOW]);
    const first = await runIntelligencePipeline(prisma, accountId, { aiClient: client });
    const second = await runIntelligencePipeline(prisma, accountId, { aiClient: client });

    assert.notEqual(first.research.id, second.research.id);
    assert.notEqual(first.whyNow?.id, second.whyNow?.id);

    const allInsights = await prisma.accountInsight.findMany({ where: { accountId } });
    assert.equal(allInsights.length, 4);
    assert.equal(allInsights.filter((i) => i.kind === "RESEARCH").length, 2);
    assert.equal(allInsights.filter((i) => i.kind === "GTM_INTELLIGENCE").length, 2);
  });
});

test("running research does not change the deterministic score", async () => {
  await withTestAccount(async (accountId) => {
    await prisma.score.create({
      data: {
        accountId,
        icpFit: 10,
        signalStrength: 0,
        problemRelevance: 0,
        buyingPersona: 0,
        engagement: 0,
        total: 10,
        scoringVersion: "v1",
        componentDetails: {},
      },
    });
    await prisma.account.update({ where: { id: accountId }, data: { icpScore: 10, currentScore: 10 } });

    const beforeScores = await prisma.score.findMany({ where: { accountId } });
    const beforeAccount = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });

    const client = queuedClient([VALID_RESEARCH, VALID_WHY_NOW]);
    await runIntelligencePipeline(prisma, accountId, { aiClient: client });

    const afterScores = await prisma.score.findMany({ where: { accountId } });
    const afterAccount = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });

    assert.equal(afterScores.length, beforeScores.length);
    assert.equal(afterAccount.currentScore, beforeAccount.currentScore);
    assert.equal(afterAccount.icpScore, beforeAccount.icpScore);
  });
});
