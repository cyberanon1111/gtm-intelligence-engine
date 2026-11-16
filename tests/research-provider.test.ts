import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockResearchProvider } from "../lib/research-provider/mockProvider";
import { createUnconfiguredResearchProvider } from "../lib/research-provider/unconfiguredProvider";
import { ResearchProviderError } from "../lib/research-provider/types";
import type { RetrievedDocument } from "../lib/research-provider/types";

const SAMPLE_DOC: RetrievedDocument = {
  url: "https://example-news.test/article",
  title: "Test Co expands fleet",
  content: "Test Co announced fleet expansion this quarter.",
};

test("the mock provider returns a static list of documents", async () => {
  const provider = createMockResearchProvider([SAMPLE_DOC]);
  const results = await provider.search({ companyName: "Test Co", website: null });
  assert.deepEqual(results, [SAMPLE_DOC]);
});

test("the mock provider supports a function for dynamic/per-call responses", async () => {
  let calls = 0;
  const provider = createMockResearchProvider(() => {
    calls += 1;
    return calls === 1 ? [SAMPLE_DOC] : [];
  });
  const first = await provider.search({ companyName: "Test Co", website: null });
  const second = await provider.search({ companyName: "Test Co", website: null });
  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
});

test("the mock provider can simulate a provider failure", async () => {
  const provider = createMockResearchProvider(new Error("simulated provider outage"));
  await assert.rejects(() => provider.search({ companyName: "Test Co", website: null }), /simulated provider outage/);
});

test("the unconfigured provider fails clearly rather than returning an empty success", async () => {
  const provider = createUnconfiguredResearchProvider();
  await assert.rejects(
    () => provider.search({ companyName: "Test Co", website: null }),
    ResearchProviderError,
  );
});

test("both providers satisfy the same ResearchProvider interface — callers never branch on vendor", async () => {
  const providers = [createMockResearchProvider([SAMPLE_DOC]), createUnconfiguredResearchProvider()];
  for (const provider of providers) {
    assert.equal(typeof provider.search, "function");
  }
});
