import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { getAccountJourney } from "../lib/journey/accountJourney";

after(async () => {
  await prisma.$disconnect();
});

async function withFixtureAccount<T>(fn: (accountId: string) => Promise<T>): Promise<T> {
  const account = await prisma.account.create({
    data: { companyName: `Test Journey Account ${Date.now()}-${Math.random()}` },
  });
  try {
    return await fn(account.id);
  } finally {
    await prisma.account.delete({ where: { id: account.id } });
  }
}

test("the journey merges signals/scores/research/activations/outcomes into one reverse-chronological feed", async () => {
  await withFixtureAccount(async (accountId) => {
    const t0 = new Date("2026-01-01T09:00:00Z");
    const t1 = new Date("2026-01-02T09:00:00Z");
    const t2 = new Date("2026-01-03T09:00:00Z");
    const t3 = new Date("2026-01-04T09:00:00Z");
    const t4 = new Date("2026-01-05T09:00:00Z");

    await prisma.signal.create({
      data: {
        accountId,
        category: "GROWTH",
        type: "FLEET_EXPANSION",
        title: "Fleet expanding",
        description: "d",
        detectedAt: t0,
        strength: 3,
        confidence: 80,
      },
    });

    await prisma.score.create({
      data: {
        accountId,
        icpFit: 10,
        signalStrength: 5,
        problemRelevance: 0,
        buyingPersona: 0,
        engagement: 0,
        total: 15,
        scoringVersion: "v1",
        componentDetails: {},
        computedAt: t1,
      },
    });

    await prisma.score.create({
      data: {
        accountId,
        icpFit: 10,
        signalStrength: 5,
        problemRelevance: 10,
        buyingPersona: 0,
        engagement: 0,
        total: 25,
        scoringVersion: "v1",
        componentDetails: {},
        computedAt: t2,
      },
    });

    await prisma.researchRun.create({
      data: {
        accountId,
        status: "COMPLETED",
        startedAt: t2,
        completedAt: t2,
        sourcesFound: 2,
        factsExtracted: 3,
        signalsDetected: 1,
        scoreBefore: 15,
        scoreAfter: 25,
      },
    });

    const activation = await prisma.activation.create({
      data: {
        accountId,
        channel: "LINKEDIN",
        objective: "Introduce MoorSense M4",
        content: { angle: "a", message: "m", cta: "c" },
        reasoning: "test fixture",
        model: "test-model",
        promptVersion: "test-v1",
        createdAt: t3,
        approvedAt: t4,
      },
    });

    await prisma.outcomeEvent.create({
      data: { accountId, activationId: activation.id, type: "REPLIED", occurredAt: t4, source: "manual" },
    });

    const journey = await getAccountJourney(prisma, accountId);

    // Reverse-chronological: the newest events come first.
    for (let i = 1; i < journey.length; i++) {
      assert.ok(
        journey[i - 1].occurredAt.getTime() >= journey[i].occurredAt.getTime(),
        "journey entries must be sorted newest-first",
      );
    }

    const types = journey.map((e) => e.type);
    assert.ok(types.includes("SIGNAL_DETECTED"));
    assert.ok(types.includes("SCORE_COMPUTED"));
    assert.ok(types.includes("RESEARCH_RUN"));
    assert.ok(types.includes("ACTIVATION_GENERATED"));
    assert.ok(types.includes("ACTIVATION_APPROVED"));
    assert.ok(types.includes("OUTCOME"));

    // 1 signal + 2 scores + 1 research run + (1 generated + 1 approved) + 1 outcome = 7
    assert.equal(journey.length, 7);

    const scoreEntries = journey.filter((e) => e.type === "SCORE_COMPUTED");
    const secondScoreEntry = scoreEntries.find((e) => e.summary.includes("15 -> 25"));
    assert.ok(secondScoreEntry, "the second score entry should show the previous -> new transition");

    const researchEntry = journey.find((e) => e.type === "RESEARCH_RUN");
    assert.equal(researchEntry?.context, "Score 15 -> 25");
  });
});

test("an account with no events yields an empty journey, not an error", async () => {
  await withFixtureAccount(async (accountId) => {
    const journey = await getAccountJourney(prisma, accountId);
    assert.deepEqual(journey, []);
  });
});
