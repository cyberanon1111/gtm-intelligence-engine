import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { computeWhatChanged } from "../lib/research/whatChanged";

after(async () => {
  await prisma.$disconnect();
});

async function withTestAccount<T>(fn: (accountId: string) => Promise<T>): Promise<T> {
  const account = await prisma.account.create({
    data: { companyName: `Test WhatChanged Account ${Date.now()}-${Math.random()}` },
  });
  try {
    return await fn(account.id);
  } finally {
    await prisma.account.delete({ where: { id: account.id } });
  }
}

test("with fewer than two completed runs, there is nothing to compare", async () => {
  await withTestAccount(async (accountId) => {
    const result = await computeWhatChanged(prisma, accountId);
    assert.equal(result.hasComparison, false);

    await prisma.researchRun.create({
      data: { accountId, status: "COMPLETED", completedAt: new Date(), scoreBefore: 0, scoreAfter: 0 },
    });
    const stillNone = await computeWhatChanged(prisma, accountId);
    assert.equal(stillNone.hasComparison, false);
  });
});

test("reports the score change and new signals between the two most recent runs", async () => {
  await withTestAccount(async (accountId) => {
    const signal = await prisma.signal.create({
      data: {
        accountId,
        category: "GROWTH",
        type: "FLEET_EXPANSION",
        title: "Fleet Expansion",
        description: "Test signal",
        detectedAt: new Date(),
        strength: 3,
        confidence: 80,
      },
    });

    await prisma.researchRun.create({
      data: {
        accountId,
        status: "COMPLETED",
        completedAt: new Date("2026-01-01"),
        scoreBefore: 10,
        scoreAfter: 10,
        newSignalIds: [],
      },
    });
    await prisma.researchRun.create({
      data: {
        accountId,
        status: "COMPLETED",
        completedAt: new Date("2026-02-01"),
        scoreBefore: 10,
        scoreAfter: 25,
        newSignalIds: [signal.id],
      },
    });

    const result = await computeWhatChanged(prisma, accountId);

    assert.equal(result.hasComparison, true);
    assert.deepEqual(result.scoreChange, { before: 10, after: 25, delta: 15 });
    assert.equal(result.newSignals.length, 1);
    assert.equal(result.newSignals[0].id, signal.id);
  });
});

test("reports a signal that newly expired between the two runs", async () => {
  await withTestAccount(async (accountId) => {
    const signal = await prisma.signal.create({
      data: {
        accountId,
        category: "GROWTH",
        type: "FLEET_EXPANSION",
        title: "Old Signal",
        description: "Test signal",
        detectedAt: new Date("2025-01-01"),
        strength: 3,
        confidence: 80,
        expiresAt: new Date("2026-01-15"), // expires between the two run timestamps below
      },
    });

    await prisma.researchRun.create({
      data: { accountId, status: "COMPLETED", completedAt: new Date("2026-01-01"), scoreBefore: 10, scoreAfter: 10 },
    });
    await prisma.researchRun.create({
      data: { accountId, status: "COMPLETED", completedAt: new Date("2026-02-01"), scoreBefore: 10, scoreAfter: 10 },
    });

    const result = await computeWhatChanged(prisma, accountId);

    assert.equal(result.newlyExpiredSignals.length, 1);
    assert.equal(result.newlyExpiredSignals[0].id, signal.id);
  });
});

test("reports new research findings that appear in the latest research snapshot but not the previous one", async () => {
  await withTestAccount(async (accountId) => {
    const previousInsight = await prisma.accountInsight.create({
      data: {
        accountId,
        kind: "RESEARCH",
        status: "COMPLETED",
        provider: "anthropic",
        model: "test",
        promptVersion: "test",
        content: {
          companySummary: "A",
          fleetProfile: "B",
          recentDevelopments: ["Old development"],
          leadershipChanges: [],
          relevantCompliance: [],
          technologySignals: [],
          evidence: [],
        },
      },
    });
    const latestInsight = await prisma.accountInsight.create({
      data: {
        accountId,
        kind: "RESEARCH",
        status: "COMPLETED",
        provider: "anthropic",
        model: "test",
        promptVersion: "test",
        content: {
          companySummary: "A",
          fleetProfile: "B",
          recentDevelopments: ["Old development", "Brand new development"],
          leadershipChanges: [],
          relevantCompliance: [],
          technologySignals: [],
          evidence: [],
        },
      },
    });

    await prisma.researchRun.create({
      data: {
        accountId,
        status: "COMPLETED",
        completedAt: new Date("2026-01-01"),
        researchInsightId: previousInsight.id,
        scoreBefore: 0,
        scoreAfter: 0,
      },
    });
    await prisma.researchRun.create({
      data: {
        accountId,
        status: "COMPLETED",
        completedAt: new Date("2026-02-01"),
        researchInsightId: latestInsight.id,
        scoreBefore: 0,
        scoreAfter: 0,
      },
    });

    const result = await computeWhatChanged(prisma, accountId);
    assert.deepEqual(result.newResearchFacts, ["Brand new development"]);
  });
});
