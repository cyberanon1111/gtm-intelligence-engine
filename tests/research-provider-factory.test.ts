import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createConfiguredResearchProvider } from "../lib/research-provider/factory";
import { createTavilyResearchProvider } from "../lib/research-provider/tavilyProvider";
import { createUnconfiguredResearchProvider } from "../lib/research-provider/unconfiguredProvider";

const originalProvider = process.env.RESEARCH_PROVIDER;

beforeEach(() => {
  delete process.env.RESEARCH_PROVIDER;
});

afterEach(() => {
  if (originalProvider === undefined) delete process.env.RESEARCH_PROVIDER;
  else process.env.RESEARCH_PROVIDER = originalProvider;
});

test("with no RESEARCH_PROVIDER set, the factory returns the unconfigured provider", async () => {
  const provider = createConfiguredResearchProvider();
  await assert.rejects(() => provider.search({ companyName: "Test", website: null }), {
    name: "ResearchProviderError",
  });
});

test("RESEARCH_PROVIDER=tavily selects the Tavily implementation", async () => {
  process.env.RESEARCH_PROVIDER = "tavily";
  const configured = createConfiguredResearchProvider();
  const direct = createTavilyResearchProvider();
  // Same behavior (throws NOT_CONFIGURED without an API key) proves it's the
  // Tavily implementation, not the unconfigured one, which throws a
  // different message.
  await assert.rejects(() => configured.search({ companyName: "Test", website: null }), (error: unknown) => {
    return error instanceof Error && error.message.includes("TAVILY_API_KEY");
  });
  await assert.rejects(() => direct.search({ companyName: "Test", website: null }), (error: unknown) => {
    return error instanceof Error && error.message.includes("TAVILY_API_KEY");
  });
});

test("an unrecognized RESEARCH_PROVIDER value falls back to unconfigured rather than crashing", async () => {
  process.env.RESEARCH_PROVIDER = "some-vendor-that-does-not-exist";
  const provider = createConfiguredResearchProvider();
  await assert.rejects(() => provider.search({ companyName: "Test", website: null }));
});

test("business logic never needs to know which provider is active — same interface either way", () => {
  const a = createConfiguredResearchProvider();
  const b = createUnconfiguredResearchProvider();
  assert.equal(typeof a.search, "function");
  assert.equal(typeof b.search, "function");
});
