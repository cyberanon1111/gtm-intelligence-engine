import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { computeAccountScore } from "../lib/scoring/engine";
import { computeAndSaveAccountScore } from "../lib/scoring/persist";
import { DIMENSION_MAX } from "../lib/scoring/constants";

after(async () => {
  await prisma.$disconnect();
});

async function withTestAccount<T>(
  data: Parameters<typeof prisma.account.create>[0]["data"],
  fn: (accountId: string) => Promise<T>,
): Promise<T> {
  const account = await prisma.account.create({ data });
  try {
    return await fn(account.id);
  } finally {
    await prisma.account.delete({ where: { id: account.id } });
  }
}

test("an empty account (no ICP match, no signals, no contacts) scores the minimum (0)", async () => {
  await withTestAccount(
    {
      companyName: `Test Empty Account ${Date.now()}`,
      companyType: "Unrecognized Type",
      fleetSize: 1,
      country: "Nowhere",
      vesselTypes: ["Unknown"],
      regions: ["Nowhere"],
    },
    async (accountId) => {
      const result = await computeAccountScore(prisma, accountId, new Date());
      assert.equal(result.icpFit, 0);
      assert.equal(result.signalStrength, 0);
      assert.equal(result.problemRelevance, 0);
      assert.equal(result.buyingPersona, 0);
      assert.equal(result.engagement, 0);
      assert.equal(result.total, 0);
    },
  );
});

test("the theoretical maximum score (100) is reachable with valid configured data", async () => {
  const dpa = await prisma.persona.findUniqueOrThrow({ where: { name: "DPA" } });
  const now = new Date();

  await withTestAccount(
    {
      companyName: `Test Max Account ${Date.now()}`,
      companyType: "Ship Manager", // ICP: +8
      fleetSize: 100, // ICP: +6
      vesselTypes: ["Tanker"], // ICP: +5
      regions: ["Europe"], // ICP: +3
      country: "Singapore", // ICP: +3  => 25 total
      contacts: {
        create: [
          {
            name: "Max Contact",
            personaId: dpa.id, // relevant + LEADERSHIP tier => 15 (dimension max)
          },
        ],
      },
      signals: {
        create: [
          // Four distinct-problem, fresh, full-confidence/strength signals —
          // one per problem defined in config/meridian/problems.ts, so Problem
          // Relevance can legitimately reach its 4-match cap.
          {
            category: "COMPLIANCE",
            type: "SIRE_ACTIVITY", // -> COMPLIANCE_READINESS
            title: "Sig 1",
            description: "",
            detectedAt: now,
            strength: 5,
            confidence: 100,
          },
          {
            category: "GROWTH",
            type: "NEW_VESSEL", // -> MOORING_MANAGEMENT_COMPLEXITY
            title: "Sig 2",
            description: "",
            detectedAt: now,
            strength: 5,
            confidence: 100,
          },
          {
            category: "TECHNOLOGY",
            type: "DIGITAL_TRANSFORMATION", // -> DIGITAL_TRANSFORMATION_GAP
            title: "Sig 3",
            description: "",
            detectedAt: now,
            strength: 5,
            confidence: 100,
          },
          {
            category: "PEOPLE",
            type: "COMPLIANCE_LEADERSHIP_CHANGE", // -> LEADERSHIP_TRANSITION_WINDOW
            title: "Sig 4",
            description: "",
            detectedAt: now,
            strength: 5,
            confidence: 100,
          },
          {
            category: "ENGAGEMENT",
            type: "DEMO_REQUEST", // engagement dimension max
            title: "Sig 5",
            description: "",
            detectedAt: now,
            strength: 5,
            confidence: 100,
          },
        ],
      },
    },
    async (accountId) => {
      const result = await computeAccountScore(prisma, accountId, now);
      assert.equal(result.icpFit, DIMENSION_MAX.ICP_FIT);
      // COMPLIANCE(10) + GROWTH(8) + TECHNOLOGY(4) + PEOPLE(3) = 25, all 4
      // non-engagement signals fit under the seeded maxSignalsCounted: 5.
      assert.equal(result.signalStrength, DIMENSION_MAX.SIGNAL_STRENGTH);
      // 4 distinct problems matched x 5 points = the full 20-point cap.
      assert.equal(result.problemRelevance, DIMENSION_MAX.PROBLEM_RELEVANCE);
      assert.equal(result.buyingPersona, DIMENSION_MAX.BUYING_PERSONA);
      assert.equal(result.engagement, DIMENSION_MAX.ENGAGEMENT);
      assert.equal(result.total, 100);
    },
  );
});

test("computeAccountScore is deterministic: same inputs + same `now` -> identical output", async () => {
  await withTestAccount(
    { companyName: `Test Determinism ${Date.now()}`, companyType: "Ship Owner", fleetSize: 20 },
    async (accountId) => {
      const now = new Date("2026-03-15T12:00:00.000Z");
      const first = await computeAccountScore(prisma, accountId, now);
      const second = await computeAccountScore(prisma, accountId, now);
      assert.deepEqual(first, second);
    },
  );
});

test("saving a score twice preserves history — creates two rows, does not overwrite", async () => {
  await withTestAccount(
    { companyName: `Test History ${Date.now()}`, companyType: "Ship Owner", fleetSize: 20 },
    async (accountId) => {
      const first = await computeAndSaveAccountScore(prisma, accountId, new Date("2026-01-01"));
      const second = await computeAndSaveAccountScore(prisma, accountId, new Date("2026-02-01"));

      assert.notEqual(first.id, second.id);

      const allScores = await prisma.score.findMany({ where: { accountId } });
      assert.equal(allScores.length, 2);
    },
  );
});

test("saving a score updates the Account's denormalized icpScore/currentScore cache", async () => {
  await withTestAccount(
    { companyName: `Test Cache ${Date.now()}`, companyType: "Ship Owner", fleetSize: 20 },
    async (accountId) => {
      const score = await computeAndSaveAccountScore(prisma, accountId, new Date());
      const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
      assert.equal(account.icpScore, score.icpFit);
      assert.equal(account.currentScore, score.total);
    },
  );
});

test("every Score row records the scoring engine version", async () => {
  await withTestAccount({ companyName: `Test Version ${Date.now()}` }, async (accountId) => {
    const score = await computeAndSaveAccountScore(prisma, accountId, new Date());
    assert.equal(score.scoringVersion, "v1");
  });
});
