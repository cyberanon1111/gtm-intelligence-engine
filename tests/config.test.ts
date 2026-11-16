import { test } from "node:test";
import assert from "node:assert/strict";
import { ICP_RULES, SCORING_RULES, PERSONAS, PRODUCTS } from "../config/meridian";

test("ICP_RULES points sum to the spec's ICP Fit cap (25)", () => {
  const sum = ICP_RULES.reduce((total, rule) => total + rule.points, 0);
  assert.equal(sum, 25);
});

test("each ScoringRule's maxPoints matches the spec's dimension cap", () => {
  const caps: Record<string, number> = {
    SIGNAL_STRENGTH: 25,
    PROBLEM_RELEVANCE: 20,
    BUYING_PERSONA: 15,
    ENGAGEMENT: 15,
  };
  for (const rule of SCORING_RULES) {
    assert.equal(
      rule.maxPoints,
      caps[rule.dimension],
      `${rule.dimension} maxPoints should be ${caps[rule.dimension]}`,
    );
  }
  const dimensionsCovered = new Set<string>(SCORING_RULES.map((r) => r.dimension));
  for (const dimension of Object.keys(caps)) {
    assert.ok(dimensionsCovered.has(dimension), `missing scoring rule for ${dimension}`);
  }
});

test("every product's personas reference a defined persona", () => {
  const personaNames = new Set(PERSONAS.map((p) => p.name));
  for (const product of PRODUCTS) {
    for (const personaName of product.personas) {
      assert.ok(
        personaNames.has(personaName),
        `Product "${product.name}" references unknown persona "${personaName}"`,
      );
    }
  }
});
