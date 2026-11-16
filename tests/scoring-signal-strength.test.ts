import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSignalStrength } from "../lib/scoring/signalStrength";
import type { Signal } from "../lib/generated/prisma/client";
import type { SignalStrengthConfig } from "../lib/scoring/configSchemas";

const NOW = new Date("2026-01-01T00:00:00.000Z");

const CONFIG: SignalStrengthConfig = {
  pointsPerCategory: { COMPLIANCE: 10, GROWTH: 8, TECHNOLOGY: 4, PEOPLE: 3 },
  maxSignalsCounted: 2,
  defaultDecayHalfLifeDays: 60,
};

function signal(overrides: Partial<Signal>): Signal {
  return {
    id: "sig_1",
    accountId: "acc_1",
    category: "COMPLIANCE",
    type: "SIRE_ACTIVITY",
    title: "Test signal",
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

test("a fresh, full-confidence, full-strength signal scores its full category value", () => {
  const { points } = computeSignalStrength([signal({})], CONFIG, NOW);
  assert.equal(points, 10);
});

test("zero signals yields the minimum score (0)", () => {
  const { points, detail } = computeSignalStrength([], CONFIG, NOW);
  assert.equal(points, 0);
  assert.deepEqual(detail.signals, []);
});

test("an expired signal contributes nothing", () => {
  const s = signal({ expiresAt: new Date("2025-12-01T00:00:00.000Z") });
  const { points, detail } = computeSignalStrength([s], CONFIG, NOW);
  assert.equal(points, 0);
  assert.equal(detail.signals[0].expired, true);
});

test("an older signal decays to less than a fresh one", () => {
  const fresh = signal({ id: "fresh", detectedAt: NOW });
  const old = signal({ id: "old", detectedAt: new Date("2025-11-02T00:00:00.000Z") }); // 60 days old = 1 half-life
  const freshResult = computeSignalStrength([fresh], CONFIG, NOW);
  const oldResult = computeSignalStrength([old], CONFIG, NOW);
  assert.ok(oldResult.points < freshResult.points);
  // one half-life => ~50% remaining => base 10 -> ~5
  assert.equal(oldResult.points, 5);
});

test("confidence and raw strength scale the contribution", () => {
  const lowConfidence = signal({ confidence: 50, strength: 5 });
  const { points } = computeSignalStrength([lowConfidence], CONFIG, NOW);
  assert.equal(points, 5); // 10 * 1 (fresh) * 0.5 confidence * 1 (5/5 strength)
});

test("only the top `maxSignalsCounted` signals contribute, ranked by effective strength", () => {
  const signals = [
    signal({ id: "a", category: "COMPLIANCE" }), // 10
    signal({ id: "b", category: "GROWTH" }), // 8
    signal({ id: "c", category: "TECHNOLOGY" }), // 4 -- should be excluded (maxSignalsCounted: 2)
  ];
  const { points, detail } = computeSignalStrength(signals, CONFIG, NOW);
  assert.equal(points, 18); // 10 + 8
  const counted = detail.signals.filter((s) => s.counted).map((s) => s.signalId);
  assert.deepEqual(counted.sort(), ["a", "b"]);
});

test("multiple signals of the same category are each counted independently", () => {
  const signals = [signal({ id: "a" }), signal({ id: "b" })];
  const { points } = computeSignalStrength(signals, CONFIG, NOW);
  assert.equal(points, 20);
});

test("a signal type not in pointsPerCategory contributes zero", () => {
  const { points } = computeSignalStrength([signal({ category: "UNKNOWN_CATEGORY" })], CONFIG, NOW);
  assert.equal(points, 0);
});

test("the total is clamped at the dimension max (25) even with many strong signals", () => {
  const signals = Array.from({ length: 5 }, (_, i) => signal({ id: `s${i}`, category: "COMPLIANCE" }));
  const generousConfig: SignalStrengthConfig = { ...CONFIG, maxSignalsCounted: 5 };
  const { points } = computeSignalStrength(signals, generousConfig, NOW);
  assert.equal(points, 25); // 5 * 10 = 50, clamped to 25
});

test("is deterministic for the same inputs and `now`", () => {
  const signals = [signal({ id: "a" }), signal({ id: "b", category: "GROWTH" })];
  const first = computeSignalStrength(signals, CONFIG, NOW);
  const second = computeSignalStrength(signals, CONFIG, NOW);
  assert.deepEqual(first, second);
});
