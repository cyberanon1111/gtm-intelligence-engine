import { test } from "node:test";
import assert from "node:assert/strict";
import { computeEngagement, type ActivityWithOutcomes } from "../lib/scoring/engagement";
import type { Signal } from "../lib/generated/prisma/client";
import type { EngagementConfig } from "../lib/scoring/configSchemas";

const NOW = new Date("2026-01-01T00:00:00.000Z");

const CONFIG: EngagementConfig = {
  pointsPerSignalType: { DEMO_REQUEST: 15, WEBSITE_ENGAGEMENT: 3 },
  pointsPerOutcomeType: { MEETING_BOOKED: 15, REPLIED: 6, NO_RESPONSE: 0 },
  aggregation: "max",
  defaultDecayHalfLifeDays: 45,
};

function engagementSignal(overrides: Partial<Signal>): Signal {
  return {
    id: "sig_1",
    accountId: "acc_1",
    category: "ENGAGEMENT",
    type: "DEMO_REQUEST",
    title: "Demo request",
    description: "",
    sourceUrl: null,
    sourceName: null,
    detectedAt: NOW,
    strength: 5,
    confidence: 100,
    decayHalfLifeDays: null,
    expiresAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Signal;
}

function activityWithOutcome(outcomeType: string): ActivityWithOutcomes {
  return {
    id: "act_1",
    accountId: "acc_1",
    contactId: null,
    type: "EMAIL_SENT",
    status: "COMPLETED",
    title: "Test activity",
    payload: null,
    createdBy: null,
    approvedBy: null,
    approvedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    outcomes: [
      {
        id: "out_1",
        activityId: "act_1",
        type: outcomeType,
        notes: null,
        occurredAt: NOW,
        createdAt: NOW,
      },
    ],
  } as ActivityWithOutcomes;
}

test("no engagement signals and no activities yields the minimum score (0) — never invented", () => {
  const { points, detail } = computeEngagement([], [], CONFIG, NOW);
  assert.equal(points, 0);
  assert.equal(detail.chosen, "none");
});

test("a fresh engagement signal scores its full configured value", () => {
  const { points, detail } = computeEngagement([engagementSignal({})], [], CONFIG, NOW);
  assert.equal(points, 15);
  assert.equal(detail.chosen, "signal");
});

test("an activity outcome contributes independently of signals", () => {
  const { points, detail } = computeEngagement([], [activityWithOutcome("MEETING_BOOKED")], CONFIG, NOW);
  assert.equal(points, 15);
  assert.equal(detail.chosen, "outcome");
});

test("takes the max of the best signal and the best outcome, not the sum", () => {
  const { points } = computeEngagement(
    [engagementSignal({ type: "WEBSITE_ENGAGEMENT" })], // 3 pts
    [activityWithOutcome("REPLIED")], // 6 pts
    CONFIG,
    NOW,
  );
  assert.equal(points, 6); // max(3, 6), not 9
});

test("an engagement signal decays over time just like other signals", () => {
  const old = engagementSignal({ detectedAt: new Date("2025-11-17T00:00:00.000Z") }); // 45 days = 1 half-life
  const { points } = computeEngagement([old], [], CONFIG, NOW);
  assert.equal(points, 8); // 15 * 0.5 = 7.5, rounded to 8
});

test("an outcome type with zero configured points contributes zero", () => {
  const { points } = computeEngagement([], [activityWithOutcome("NO_RESPONSE")], CONFIG, NOW);
  assert.equal(points, 0);
});

test("the total is clamped at the dimension max (15)", () => {
  const config: EngagementConfig = { ...CONFIG, pointsPerOutcomeType: { MEETING_BOOKED: 999 } };
  const { points } = computeEngagement([], [activityWithOutcome("MEETING_BOOKED")], config, NOW);
  assert.equal(points, 15);
});

test("is deterministic for the same inputs and `now`", () => {
  const signals = [engagementSignal({})];
  const activities = [activityWithOutcome("REPLIED")];
  const first = computeEngagement(signals, activities, CONFIG, NOW);
  const second = computeEngagement(signals, activities, CONFIG, NOW);
  assert.deepEqual(first, second);
});
