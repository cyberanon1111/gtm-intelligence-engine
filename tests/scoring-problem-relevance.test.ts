import { test } from "node:test";
import assert from "node:assert/strict";
import { computeProblemRelevance } from "../lib/scoring/problemRelevance";
import type { Signal } from "../lib/generated/prisma/client";
import type { ProblemRelevanceConfig } from "../lib/scoring/configSchemas";

const CONFIG: ProblemRelevanceConfig = { pointsPerMatchedProblem: 5, maxMatches: 4 };
const PRODUCTS = [{ id: "prod_1", name: "MoorSense M4" }];

function signal(overrides: Partial<Signal>): Signal {
  return {
    id: "sig_1",
    accountId: "acc_1",
    category: "GROWTH",
    type: "NEW_VESSEL",
    title: "Test signal",
    description: "",
    sourceUrl: null,
    sourceName: null,
    detectedAt: new Date(),
    strength: 3,
    confidence: 80,
    decayHalfLifeDays: null,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Signal;
}

test("zero signals yields the minimum score (0) with no matched problems", () => {
  const { points, detail } = computeProblemRelevance([], CONFIG, PRODUCTS);
  assert.equal(points, 0);
  assert.deepEqual(detail.matchedProblems, []);
});

test("a signal type mapped to a known problem earns points and resolves the relevant product", () => {
  const { points, detail } = computeProblemRelevance([signal({ type: "NEW_VESSEL" })], CONFIG, PRODUCTS);
  assert.equal(points, 5);
  assert.equal(detail.matchedProblems.length, 1);
  assert.equal(detail.matchedProblems[0].problemKey, "MOORING_MANAGEMENT_COMPLEXITY");
  assert.equal(detail.matchedProblems[0].relevantProducts[0].name, "MoorSense M4");
});

test("a signal type with no configured problem mapping contributes nothing", () => {
  const { points } = computeProblemRelevance([signal({ type: "RELEVANT_HIRING" })], CONFIG, PRODUCTS);
  assert.equal(points, 0);
});

test("multiple signals mapping to distinct problems are counted separately", () => {
  const signals = [signal({ id: "a", type: "NEW_VESSEL" }), signal({ id: "b", type: "SIRE_ACTIVITY" })];
  const { points, detail } = computeProblemRelevance(signals, CONFIG, PRODUCTS);
  assert.equal(points, 10);
  assert.equal(detail.matchedProblems.length, 2);
});

test("multiple signals mapping to the SAME problem count that problem once, citing all evidence", () => {
  const signals = [
    signal({ id: "a", type: "NEW_VESSEL" }),
    signal({ id: "b", type: "FLEET_EXPANSION" }), // also maps to MOORING_MANAGEMENT_COMPLEXITY
  ];
  const { points, detail } = computeProblemRelevance(signals, CONFIG, PRODUCTS);
  assert.equal(points, 5);
  assert.equal(detail.matchedProblems.length, 1);
  assert.deepEqual(detail.matchedProblems[0].evidenceSignalIds.sort(), ["a", "b"]);
});

test("four signals spanning all four configured problems legitimately reach the full 20-point cap", () => {
  const signals = [
    signal({ id: "a", type: "NEW_VESSEL" }), // MOORING_MANAGEMENT_COMPLEXITY
    signal({ id: "b", type: "SIRE_ACTIVITY" }), // COMPLIANCE_READINESS
    signal({ id: "c", type: "DIGITAL_TRANSFORMATION" }), // DIGITAL_TRANSFORMATION_GAP
    signal({ id: "d", type: "COMPLIANCE_LEADERSHIP_CHANGE" }), // LEADERSHIP_TRANSITION_WINDOW
  ];
  const { points, detail } = computeProblemRelevance(signals, CONFIG, PRODUCTS);
  assert.equal(points, 20);
  assert.equal(detail.matchedProblems.length, 4);
});

test("matches are capped at maxMatches even with more distinct problems available", () => {
  const config: ProblemRelevanceConfig = { pointsPerMatchedProblem: 5, maxMatches: 1 };
  const signals = [signal({ id: "a", type: "NEW_VESSEL" }), signal({ id: "b", type: "SIRE_ACTIVITY" })];
  const { points, detail } = computeProblemRelevance(signals, config, PRODUCTS);
  assert.equal(points, 5); // only 1 counted even though 2 distinct problems matched
  assert.equal(detail.matchedProblems.length, 2); // both still reported for explainability
});

test("the total is clamped at the dimension max (20)", () => {
  const config: ProblemRelevanceConfig = { pointsPerMatchedProblem: 100, maxMatches: 4 };
  const { points } = computeProblemRelevance([signal({ type: "NEW_VESSEL" })], config, PRODUCTS);
  assert.equal(points, 20);
});

test("is deterministic for the same inputs", () => {
  const signals = [signal({ type: "NEW_VESSEL" })];
  const first = computeProblemRelevance(signals, CONFIG, PRODUCTS);
  const second = computeProblemRelevance(signals, CONFIG, PRODUCTS);
  assert.deepEqual(first, second);
});
