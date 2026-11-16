import { test } from "node:test";
import assert from "node:assert/strict";
import { getSignalFreshnessLabel } from "../lib/signals/freshness";

const NOW = new Date("2026-06-01T00:00:00.000Z");

test("a just-detected signal is FRESH", () => {
  const label = getSignalFreshnessLabel({ category: "COMPLIANCE", detectedAt: NOW }, NOW);
  assert.equal(label, "FRESH");
});

test("a signal within the first half of its category's expectation window is FRESH", () => {
  // COMPLIANCE expects 90 days; 30 days old is well within the first half
  const detectedAt = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
  assert.equal(getSignalFreshnessLabel({ category: "COMPLIANCE", detectedAt }, NOW), "FRESH");
});

test("a signal past the halfway point but within the full window is AGING", () => {
  const detectedAt = new Date(NOW.getTime() - 70 * 24 * 60 * 60 * 1000); // 90-day window, 70 days old
  assert.equal(getSignalFreshnessLabel({ category: "COMPLIANCE", detectedAt }, NOW), "AGING");
});

test("a signal older than its category's full expectation window is STALE", () => {
  const detectedAt = new Date(NOW.getTime() - 200 * 24 * 60 * 60 * 1000); // well past 90 days
  assert.equal(getSignalFreshnessLabel({ category: "COMPLIANCE", detectedAt }, NOW), "STALE");
});

test("different categories have different expectation windows", () => {
  const detectedAt = new Date(NOW.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days old
  // COMPLIANCE (90d window) should be STALE at 100 days
  assert.equal(getSignalFreshnessLabel({ category: "COMPLIANCE", detectedAt }, NOW), "STALE");
  // PEOPLE (180d window) should still be within window at 100 days
  assert.notEqual(getSignalFreshnessLabel({ category: "PEOPLE", detectedAt }, NOW), "STALE");
});

test("an unrecognized category falls back to the default freshness window rather than throwing", () => {
  const detectedAt = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000);
  assert.doesNotThrow(() => getSignalFreshnessLabel({ category: "UNKNOWN_CATEGORY", detectedAt }, NOW));
});
