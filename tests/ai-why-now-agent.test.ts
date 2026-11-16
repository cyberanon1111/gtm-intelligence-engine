import { test } from "node:test";
import assert from "node:assert/strict";
import { runWhyNowAgent } from "../lib/ai/agents/whyNowAgent";
import { AIResponseParseError, AIResponseValidationError } from "../lib/ai/errors";
import type { AIClient } from "../lib/ai/client";
import type { WhyNowPromptInput } from "../lib/ai/prompts/whyNow";

function fakeClient(response: string): AIClient {
  return {
    async complete() {
      return response;
    },
  };
}

const INPUT: WhyNowPromptInput = {
  account: { companyName: "Test Co", companyType: "Ship Owner", country: "Norway", fleetSize: 12, status: "NEW" },
  score: {
    total: 40,
    icpFit: 20,
    signalStrength: 10,
    problemRelevance: 5,
    buyingPersona: 5,
    engagement: 0,
    matchedProblems: [
      {
        problemKey: "MOORING_MANAGEMENT_COMPLEXITY",
        label: "Mooring Management Complexity",
        description: "Growing fleet.",
        relevantProducts: [{ name: "MoorSense M4" }],
      },
    ],
    matchedContacts: [{ name: "Jane Doe", personaName: "Marine Manager", seniorityTier: "MANAGEMENT" }],
  },
  research: null,
  availablePersonas: ["Marine Manager", "DPA"],
  availableProducts: [{ name: "MoorSense M4", description: "Mooring management platform." }],
};

const VALID_RESULT = {
  whyNow: "The account is expanding its fleet, which increases mooring management complexity.",
  potentialProblems: [
    {
      problemKey: "MOORING_MANAGEMENT_COMPLEXITY",
      label: "Mooring Management Complexity",
      rationale: "Fleet expansion increases manual monitoring burden.",
    },
  ],
  relevantProducts: [{ productName: "MoorSense M4", rationale: "Addresses mooring complexity." }],
  relevantPersonas: [
    {
      personaName: "Marine Manager",
      rationale: "Owns day-to-day mooring safety.",
      stakeholderLabel: "relevant stakeholder",
    },
  ],
  recommendedNextStep: "Share a MoorSense M4 case study with the Marine Manager.",
  confidence: 60,
  supportingEvidence: [
    { sourceName: "Deterministic score", claim: "Problem relevance matched mooring complexity", claimType: "FACT", confidence: 100 },
  ],
};

test("a valid, grounded response is parsed and returned unchanged", async () => {
  const client = fakeClient(JSON.stringify(VALID_RESULT));
  const result = await runWhyNowAgent(client, INPUT);
  assert.equal(result.potentialProblems.length, 1);
  assert.equal(result.relevantProducts.length, 1);
  assert.equal(result.relevantPersonas.length, 1);
});

test("a hallucinated problemKey not in the deterministic matchedProblems is dropped", async () => {
  const hallucinated = {
    ...VALID_RESULT,
    potentialProblems: [
      ...VALID_RESULT.potentialProblems,
      { problemKey: "MADE_UP_PROBLEM", label: "Fake", rationale: "Invented" },
    ],
  };
  const client = fakeClient(JSON.stringify(hallucinated));
  const result = await runWhyNowAgent(client, INPUT);
  assert.equal(result.potentialProblems.length, 1);
  assert.equal(result.potentialProblems[0].problemKey, "MOORING_MANAGEMENT_COMPLEXITY");
});

test("a hallucinated product name not in availableProducts is dropped", async () => {
  const hallucinated = {
    ...VALID_RESULT,
    relevantProducts: [...VALID_RESULT.relevantProducts, { productName: "Fake Product X", rationale: "Invented" }],
  };
  const client = fakeClient(JSON.stringify(hallucinated));
  const result = await runWhyNowAgent(client, INPUT);
  assert.equal(result.relevantProducts.length, 1);
  assert.equal(result.relevantProducts[0].productName, "MoorSense M4");
});

test("a hallucinated persona name not in availablePersonas is dropped", async () => {
  const hallucinated = {
    ...VALID_RESULT,
    relevantPersonas: [
      ...VALID_RESULT.relevantPersonas,
      { personaName: "Chief Astronaut", rationale: "Invented", stakeholderLabel: "relevant stakeholder" },
    ],
  };
  const client = fakeClient(JSON.stringify(hallucinated));
  const result = await runWhyNowAgent(client, INPUT);
  assert.equal(result.relevantPersonas.length, 1);
  assert.equal(result.relevantPersonas[0].personaName, "Marine Manager");
});

test("an invalid stakeholderLabel (e.g. implying decision-maker status) is rejected by schema", async () => {
  const invalid = {
    ...VALID_RESULT,
    relevantPersonas: [{ ...VALID_RESULT.relevantPersonas[0], stakeholderLabel: "decision maker" }],
  };
  const client = fakeClient(JSON.stringify(invalid));
  await assert.rejects(() => runWhyNowAgent(client, INPUT), AIResponseValidationError);
});

test("malformed (non-JSON) output throws AIResponseParseError", async () => {
  const client = fakeClient("not json at all");
  await assert.rejects(() => runWhyNowAgent(client, INPUT), AIResponseParseError);
});

test("when there is no matched problem, all AI-claimed problems are dropped (never invented from nothing)", async () => {
  const noScoreInput: WhyNowPromptInput = { ...INPUT, score: null };
  const client = fakeClient(JSON.stringify(VALID_RESULT));
  const result = await runWhyNowAgent(client, noScoreInput);
  assert.deepEqual(result.potentialProblems, []);
});
