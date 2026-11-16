import { test } from "node:test";
import assert from "node:assert/strict";
import { runResearchAgent } from "../lib/ai/agents/researchAgent";
import { AIResponseParseError, AIResponseValidationError, AIProviderError } from "../lib/ai/errors";
import type { AIClient } from "../lib/ai/client";
import type { ResearchPromptInput } from "../lib/ai/prompts/research";

function fakeClient(response: string | Error): AIClient {
  return {
    async complete() {
      if (response instanceof Error) throw response;
      return response;
    },
  };
}

const INPUT: ResearchPromptInput = {
  account: {
    companyName: "Test Co",
    website: "https://test.example",
    country: "Norway",
    companyType: "Ship Owner",
    fleetSize: 12,
    vesselTypes: ["Bulk Carrier"],
    regions: ["Europe"],
    status: "NEW",
  },
  contacts: [],
  signals: [],
  currentScore: null,
};

const VALID_RESULT = {
  companySummary: "Test Co is a bulk carrier owner operating in Europe.",
  fleetProfile: "Operates 12 bulk carriers.",
  recentDevelopments: ["Announced fleet expansion"],
  leadershipChanges: [],
  relevantCompliance: [],
  technologySignals: [],
  evidence: [
    {
      sourceName: "Account record",
      claim: "Fleet size is 12 vessels",
      claimType: "FACT",
      confidence: 100,
    },
  ],
};

test("a valid, schema-conforming response is parsed and returned", async () => {
  const client = fakeClient(JSON.stringify(VALID_RESULT));
  const result = await runResearchAgent(client, INPUT);
  assert.equal(result.companySummary, VALID_RESULT.companySummary);
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0].claimType, "FACT");
});

test("a response wrapped in a markdown code fence is still extracted correctly", async () => {
  const client = fakeClient("```json\n" + JSON.stringify(VALID_RESULT) + "\n```");
  const result = await runResearchAgent(client, INPUT);
  assert.equal(result.companySummary, VALID_RESULT.companySummary);
});

test("an UNKNOWN / empty response is valid, not an error", async () => {
  const empty = {
    companySummary: "UNKNOWN",
    fleetProfile: "UNKNOWN",
    recentDevelopments: [],
    leadershipChanges: [],
    relevantCompliance: [],
    technologySignals: [],
    evidence: [],
  };
  const client = fakeClient(JSON.stringify(empty));
  const result = await runResearchAgent(client, INPUT);
  assert.equal(result.companySummary, "UNKNOWN");
  assert.deepEqual(result.evidence, []);
});

test("malformed (non-JSON) model output throws AIResponseParseError, not a silent fallback", async () => {
  const client = fakeClient("Sure, here is my analysis: the company looks promising.");
  await assert.rejects(() => runResearchAgent(client, INPUT), AIResponseParseError);
});

test("JSON missing a required field throws AIResponseValidationError", async () => {
  const missingField: Partial<typeof VALID_RESULT> = { ...VALID_RESULT };
  delete missingField.companySummary;
  const client = fakeClient(JSON.stringify(missingField));
  await assert.rejects(() => runResearchAgent(client, INPUT), AIResponseValidationError);
});

test("an invalid claimType enum value is rejected, never silently coerced", async () => {
  const invalid = {
    ...VALID_RESULT,
    evidence: [{ ...VALID_RESULT.evidence[0], claimType: "MAYBE_TRUE" }],
  };
  const client = fakeClient(JSON.stringify(invalid));
  await assert.rejects(() => runResearchAgent(client, INPUT), AIResponseValidationError);
});

test("a provider failure (e.g. API error/timeout) propagates rather than being swallowed", async () => {
  const client = fakeClient(new AIProviderError("Request to the model timed out."));
  await assert.rejects(() => runResearchAgent(client, INPUT), AIProviderError);
});
