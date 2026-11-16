import { test } from "node:test";
import assert from "node:assert/strict";
import { runActivationAgent } from "../lib/ai/agents/activationAgent";
import { AIResponseParseError, AIResponseValidationError } from "../lib/ai/errors";
import type { AIClient } from "../lib/ai/client";
import type { ActivationPromptInput } from "../lib/ai/prompts/activation";
import type {
  LinkedinResult,
  SalesBriefResult,
  ContentRecommendationResult,
} from "../lib/ai/schemas/activation";

function fakeClient(response: string): AIClient {
  return {
    async complete() {
      return response;
    },
  };
}

const BASE_INPUT: Omit<ActivationPromptInput, "channel"> = {
  objective: "Introduce MoorSense M4",
  account: { companyName: "Test Co", companyType: "Ship Manager", country: "Norway", fleetSize: 12, status: "NEW" },
  contact: { name: "Jane Doe", title: "Marine Manager", personaName: "Marine Manager" },
  score: { total: 60, matchedProblems: [{ problemKey: "MOORING_MANAGEMENT_COMPLEXITY", label: "Mooring Complexity", relevantProducts: [{ name: "MoorSense M4" }] }] },
  whyNow: null,
  research: null,
  evidence: [{ id: "ev_1", claim: "Fleet is expanding", claimType: "FACT", sourceName: "Test Source" }],
};

const VALID_OUTBOUND = {
  objective: "Introduce MoorSense M4",
  reasoning: "Fleet is expanding, which increases mooring complexity.",
  evidenceUsed: ["ev_1"],
  confidence: 60,
  content: { angle: "Fleet growth", message: "Hi Jane, ...", cta: "Would you be open to a quick call?" },
};

const VALID_SALES_BRIEF = {
  objective: "Prep for outreach",
  reasoning: "Summarizing known facts for the team.",
  evidenceUsed: ["ev_1"],
  confidence: 55,
  content: {
    whyNow: "Fleet expansion increases mooring complexity.",
    relevantSignals: ["Fleet expansion"],
    relevantProblem: "Mooring Management Complexity",
    potentialStakeholder: "Jane Doe (Marine Manager)",
    relevantProduct: "MoorSense M4",
    suggestedOpening: "I saw you're expanding the fleet — how are you handling mooring monitoring today?",
  },
};

const VALID_CONTENT_REC = {
  objective: "Suggest content",
  reasoning: "A case study would resonate with this persona.",
  evidenceUsed: ["ev_1"],
  confidence: 50,
  content: {
    targetProblem: "Mooring Management Complexity",
    targetPersona: "Marine Manager",
    contentAngle: "How growing fleets manage mooring risk",
    suggestedFormat: "Case study",
    supportingEvidenceSummary: "Fleet is expanding per on-file signal.",
    suggestedCta: "Download the case study",
  },
};

test("a valid LINKEDIN response is parsed and returned", async () => {
  const client = fakeClient(JSON.stringify(VALID_OUTBOUND));
  const result = (await runActivationAgent(client, { ...BASE_INPUT, channel: "LINKEDIN" })) as LinkedinResult;
  assert.equal(result.content.message, VALID_OUTBOUND.content.message);
});

test("a valid EMAIL response is parsed and returned", async () => {
  const client = fakeClient(JSON.stringify(VALID_OUTBOUND));
  const result = (await runActivationAgent(client, { ...BASE_INPUT, channel: "EMAIL" })) as LinkedinResult;
  assert.equal(result.content.cta, VALID_OUTBOUND.content.cta);
});

test("a valid SALES_BRIEF response is parsed and returned with its distinct shape", async () => {
  const client = fakeClient(JSON.stringify(VALID_SALES_BRIEF));
  const result = (await runActivationAgent(client, { ...BASE_INPUT, channel: "SALES_BRIEF" })) as SalesBriefResult;
  assert.equal(result.content.relevantProduct, "MoorSense M4");
  assert.deepEqual(result.content.relevantSignals, ["Fleet expansion"]);
});

test("a valid CONTENT_RECOMMENDATION response is parsed and returned with its distinct shape", async () => {
  const client = fakeClient(JSON.stringify(VALID_CONTENT_REC));
  const result = (await runActivationAgent(client, {
    ...BASE_INPUT,
    channel: "CONTENT_RECOMMENDATION",
  })) as ContentRecommendationResult;
  assert.equal(result.content.suggestedFormat, "Case study");
});

test("malformed (non-JSON) output throws AIResponseParseError", async () => {
  const client = fakeClient("Sure, here's a draft: ...");
  await assert.rejects(() => runActivationAgent(client, { ...BASE_INPUT, channel: "LINKEDIN" }), AIResponseParseError);
});

test("a LINKEDIN response with SALES_BRIEF-shaped content is rejected (wrong shape for the channel)", async () => {
  const client = fakeClient(JSON.stringify(VALID_SALES_BRIEF));
  await assert.rejects(
    () => runActivationAgent(client, { ...BASE_INPUT, channel: "LINKEDIN" }),
    AIResponseValidationError,
  );
});

test("a missing required content field is rejected", async () => {
  const invalid = { ...VALID_OUTBOUND, content: { angle: "Fleet growth", message: "Hi Jane" } }; // missing cta
  const client = fakeClient(JSON.stringify(invalid));
  await assert.rejects(
    () => runActivationAgent(client, { ...BASE_INPUT, channel: "LINKEDIN" }),
    AIResponseValidationError,
  );
});

test("a confidence value outside 0-100 is rejected, not clamped", async () => {
  const invalid = { ...VALID_OUTBOUND, confidence: 150 };
  const client = fakeClient(JSON.stringify(invalid));
  await assert.rejects(
    () => runActivationAgent(client, { ...BASE_INPUT, channel: "LINKEDIN" }),
    AIResponseValidationError,
  );
});
