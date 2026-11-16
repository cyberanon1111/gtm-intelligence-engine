import { test } from "node:test";
import assert from "node:assert/strict";
import { detectSignalCandidates } from "../lib/research/signalDetection";
import type { SignalDetectionRule } from "../config/meridian/signalDetection";

const RULES: SignalDetectionRule[] = [
  { signalType: "FLEET_EXPANSION", category: "GROWTH", keywords: ["fleet expansion", "expanding its fleet"], defaultStrength: 3 },
  { signalType: "LEADERSHIP_CHANGE", category: "PEOPLE", keywords: ["appointed", "new chief"], defaultStrength: 3 },
  { signalType: "COMPLIANCE_ACTIVITY", category: "COMPLIANCE", keywords: ["sire", "vetting"], defaultStrength: 3 },
];

test("a fact whose statement contains a rule's keyword matches that rule", () => {
  const candidates = detectSignalCandidates({ statement: "The company is expanding its fleet this year.", confidence: 80 }, RULES);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].signalType, "FLEET_EXPANSION");
});

test("matching is case-insensitive", () => {
  const candidates = detectSignalCandidates({ statement: "FLEET EXPANSION announced today.", confidence: 80 }, RULES);
  assert.equal(candidates.length, 1);
});

test("a fact matching no rule's keywords returns no candidates", () => {
  const candidates = detectSignalCandidates({ statement: "The weather was pleasant.", confidence: 80 }, RULES);
  assert.deepEqual(candidates, []);
});

test("a fact matching multiple rules returns every match, not just the first", () => {
  const candidates = detectSignalCandidates(
    { statement: "The company appointed a new Head of Compliance to oversee its vetting programme.", confidence: 80 },
    RULES,
  );
  const types = candidates.map((c) => c.signalType).sort();
  assert.deepEqual(types, ["COMPLIANCE_ACTIVITY", "LEADERSHIP_CHANGE"]);
});

test("uses the default exported SIGNAL_DETECTION_RULES when none are passed", () => {
  const candidates = detectSignalCandidates({ statement: "Acme acquired a competitor this week.", confidence: 80 });
  assert.ok(candidates.some((c) => c.signalType === "ACQUISITION"));
});
