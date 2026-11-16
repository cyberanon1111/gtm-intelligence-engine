import { test } from "node:test";
import assert from "node:assert/strict";
import { runFactExtractionAgent } from "../lib/ai/agents/factExtractionAgent";
import { AIResponseParseError, AIResponseValidationError } from "../lib/ai/errors";
import type { AIClient } from "../lib/ai/client";

function fakeClient(response: string): AIClient {
  return {
    async complete() {
      return response;
    },
  };
}

const INPUT = {
  accountCompanyName: "Test Co",
  documentTitle: "Test Co news",
  documentContent: "Test Co took delivery of two new bulk carriers in March 2026.",
};

test("a valid extraction response is parsed and returned", async () => {
  const client = fakeClient(
    JSON.stringify({
      facts: [
        { statement: "Test Co took delivery of two new bulk carriers.", confidence: 90, context: "March 2026" },
      ],
    }),
  );
  const result = await runFactExtractionAgent(client, INPUT);
  assert.equal(result.facts.length, 1);
  assert.equal(result.facts[0].confidence, 90);
});

test("an empty facts array is valid — nothing extractable is not an error", async () => {
  const client = fakeClient(JSON.stringify({ facts: [] }));
  const result = await runFactExtractionAgent(client, INPUT);
  assert.deepEqual(result.facts, []);
});

test("malformed (non-JSON) output throws AIResponseParseError", async () => {
  const client = fakeClient("Here are the facts I found: nothing much.");
  await assert.rejects(() => runFactExtractionAgent(client, INPUT), AIResponseParseError);
});

test("a confidence value outside 0-100 is rejected, not clamped", async () => {
  const client = fakeClient(JSON.stringify({ facts: [{ statement: "X happened.", confidence: 150 }] }));
  await assert.rejects(() => runFactExtractionAgent(client, INPUT), AIResponseValidationError);
});

test("a missing statement field is rejected", async () => {
  const client = fakeClient(JSON.stringify({ facts: [{ confidence: 80 }] }));
  await assert.rejects(() => runFactExtractionAgent(client, INPUT), AIResponseValidationError);
});
