import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { runResearchWorkflow } from "../lib/research/researchRun";
import type { AIClient } from "../lib/ai/client";

after(async () => {
  await prisma.$disconnect();
});

function queuedClient(responses: string[]): AIClient {
  let i = 0;
  return {
    async complete() {
      const next = responses[i++];
      if (next === undefined) throw new Error("queuedClient called more times than responses provided");
      return next;
    },
  };
}

const VALID_RESEARCH = JSON.stringify({
  companySummary: "Test Co.",
  fleetProfile: "Small fleet.",
  recentDevelopments: [],
  leadershipChanges: [],
  relevantCompliance: [],
  technologySignals: [],
  evidence: [],
});
const VALID_WHY_NOW = JSON.stringify({
  whyNow: "N/A",
  potentialProblems: [],
  relevantProducts: [],
  relevantPersonas: [],
  recommendedNextStep: "N/A",
  confidence: 10,
  supportingEvidence: [],
});

async function withTestAccount<T>(fn: (accountId: string) => Promise<T>): Promise<T> {
  const account = await prisma.account.create({
    data: { companyName: `Test RunFreshness Account ${Date.now()}-${Math.random()}` },
  });
  try {
    return await fn(account.id);
  } finally {
    await prisma.account.delete({ where: { id: account.id } });
  }
}

test("the first run for an account proceeds normally — nothing to be fresh against", async () => {
  await withTestAccount(async (accountId) => {
    const client = queuedClient([VALID_RESEARCH, VALID_WHY_NOW]);
    const run = await runResearchWorkflow(prisma, accountId, { aiClient: client }, { force: false });
    assert.notEqual(run.status, "SKIPPED");
  });
});

test("a second call without force, shortly after a completed run, is SKIPPED and makes no AI calls", async () => {
  await withTestAccount(async (accountId) => {
    const firstClient = queuedClient([VALID_RESEARCH, VALID_WHY_NOW]);
    await runResearchWorkflow(prisma, accountId, { aiClient: firstClient }, { force: false });

    // Zero responses queued — if the workflow makes any AI call at all, this
    // throws and the test fails, proving the skip happened before any work.
    const secondClient = queuedClient([]);
    const secondRun = await runResearchWorkflow(prisma, accountId, { aiClient: secondClient }, { force: false });

    assert.equal(secondRun.status, "SKIPPED");
    const errors = secondRun.errors as { step: string; message: string }[];
    assert.ok(errors.some((e) => e.step === "freshness_check"));
  });
});

test("force: true always bypasses the freshness window, even immediately after a run", async () => {
  await withTestAccount(async (accountId) => {
    const firstClient = queuedClient([VALID_RESEARCH, VALID_WHY_NOW]);
    await runResearchWorkflow(prisma, accountId, { aiClient: firstClient }, { force: false });

    const secondClient = queuedClient([VALID_RESEARCH, VALID_WHY_NOW]);
    const secondRun = await runResearchWorkflow(prisma, accountId, { aiClient: secondClient }, { force: true });

    assert.notEqual(secondRun.status, "SKIPPED");
  });
});

test("a custom (shorter) freshness window is honored", async () => {
  await withTestAccount(async (accountId) => {
    const firstClient = queuedClient([VALID_RESEARCH, VALID_WHY_NOW]);
    await runResearchWorkflow(
      prisma,
      accountId,
      { aiClient: firstClient, freshnessWindowHours: 0.0001 }, // effectively already stale by the next call
      { force: false },
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    const secondClient = queuedClient([VALID_RESEARCH, VALID_WHY_NOW]);
    const secondRun = await runResearchWorkflow(
      prisma,
      accountId,
      { aiClient: secondClient, freshnessWindowHours: 0.0001 },
      { force: false },
    );

    assert.notEqual(secondRun.status, "SKIPPED");
  });
});

test("a SKIPPED run still records scoreBefore/scoreAfter as unchanged", async () => {
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

    const firstClient = queuedClient([VALID_RESEARCH, VALID_WHY_NOW]);
    await runResearchWorkflow(prisma, accountId, { aiClient: firstClient }, { force: false });

    const secondClient = queuedClient([]);
    const secondRun = await runResearchWorkflow(prisma, accountId, { aiClient: secondClient }, { force: false });

    assert.equal(secondRun.status, "SKIPPED");
    assert.equal(secondRun.scoreBefore, secondRun.scoreAfter);
  });
});
