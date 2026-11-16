import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTavilyResearchProvider } from "../lib/research-provider/tavilyProvider";
import { ResearchProviderError } from "../lib/research-provider/types";
import { RESEARCH_PROVIDER_LIMITS } from "../config/meridian/researchProvider";

const originalKey = process.env.TAVILY_API_KEY;

beforeEach(() => {
  process.env.TAVILY_API_KEY = "test-key";
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.TAVILY_API_KEY;
  else process.env.TAVILY_API_KEY = originalKey;
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("without TAVILY_API_KEY configured, search throws a NOT_CONFIGURED error", async () => {
  delete process.env.TAVILY_API_KEY;
  const provider = createTavilyResearchProvider();
  await assert.rejects(
    () => provider.search({ companyName: "Test Co", website: null }),
    (error: unknown) => error instanceof ResearchProviderError && error.kind === "NOT_CONFIGURED",
  );
});

test("a successful response maps results to RetrievedDocument[]", async () => {
  const fetchImpl = async () =>
    jsonResponse(200, {
      results: [
        { url: "https://example.test/a", title: "Article A", content: "Content A", published_date: "2026-03-01" },
      ],
    });
  const provider = createTavilyResearchProvider({ fetchImpl });
  const docs = await provider.search({ companyName: "Test Co", website: null });
  assert.equal(docs.length, 1);
  assert.equal(docs[0].url, "https://example.test/a");
  assert.equal(docs[0].publishedAt, "2026-03-01");
});

test("an empty results array is a valid, successful outcome — not an error", async () => {
  const fetchImpl = async () => jsonResponse(200, { results: [] });
  const provider = createTavilyResearchProvider({ fetchImpl });
  const docs = await provider.search({ companyName: "Test Co", website: null });
  assert.deepEqual(docs, []);
});

test("a 401 response is classified as an AUTH failure", async () => {
  const fetchImpl = async () => jsonResponse(401, { error: "unauthorized" });
  const provider = createTavilyResearchProvider({ fetchImpl });
  await assert.rejects(
    () => provider.search({ companyName: "Test Co", website: null }),
    (error: unknown) => error instanceof ResearchProviderError && error.kind === "AUTH",
  );
});

test("a 429 response is classified as a RATE_LIMIT failure", async () => {
  const fetchImpl = async () => jsonResponse(429, { error: "rate limited" });
  const provider = createTavilyResearchProvider({ fetchImpl });
  await assert.rejects(
    () => provider.search({ companyName: "Test Co", website: null }),
    (error: unknown) => error instanceof ResearchProviderError && error.kind === "RATE_LIMIT",
  );
});

test("a 5xx response is classified as UNAVAILABLE", async () => {
  const fetchImpl = async () => jsonResponse(503, { error: "down" });
  const provider = createTavilyResearchProvider({ fetchImpl });
  await assert.rejects(
    () => provider.search({ companyName: "Test Co", website: null }),
    (error: unknown) => error instanceof ResearchProviderError && error.kind === "UNAVAILABLE",
  );
});

test("a non-JSON response body is classified as MALFORMED_RESPONSE", async () => {
  const fetchImpl = async () => new Response("not json", { status: 200 });
  const provider = createTavilyResearchProvider({ fetchImpl });
  await assert.rejects(
    () => provider.search({ companyName: "Test Co", website: null }),
    (error: unknown) => error instanceof ResearchProviderError && error.kind === "MALFORMED_RESPONSE",
  );
});

test("a JSON response missing the results array is classified as MALFORMED_RESPONSE", async () => {
  const fetchImpl = async () => jsonResponse(200, { unexpected: "shape" });
  const provider = createTavilyResearchProvider({ fetchImpl });
  await assert.rejects(
    () => provider.search({ companyName: "Test Co", website: null }),
    (error: unknown) => error instanceof ResearchProviderError && error.kind === "MALFORMED_RESPONSE",
  );
});

test("a network error is retried before failing, and classified as UNAVAILABLE", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new Error("network down");
  };
  const provider = createTavilyResearchProvider({ fetchImpl });
  await assert.rejects(
    () => provider.search({ companyName: "Test Co", website: null }),
    (error: unknown) => error instanceof ResearchProviderError && error.kind === "UNAVAILABLE",
  );
  assert.equal(calls, RESEARCH_PROVIDER_LIMITS.retryCount + 1);
});

test("a transient failure followed by success still returns results (retry works)", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) throw new Error("transient network error");
    return jsonResponse(200, { results: [{ url: "https://example.test/b", title: "B", content: "content" }] });
  };
  const provider = createTavilyResearchProvider({ fetchImpl });
  const docs = await provider.search({ companyName: "Test Co", website: null });
  assert.equal(docs.length, 1);
  assert.equal(calls, 2);
});

test("results are capped at maxDocumentsPerRun and content is truncated to maxContentChars", async () => {
  const manyResults = Array.from({ length: RESEARCH_PROVIDER_LIMITS.maxDocumentsPerRun + 5 }, (_, i) => ({
    url: `https://example.test/${i}`,
    title: `Article ${i}`,
    content: "x".repeat(RESEARCH_PROVIDER_LIMITS.maxContentChars + 500),
  }));
  const fetchImpl = async () => jsonResponse(200, { results: manyResults });
  const provider = createTavilyResearchProvider({ fetchImpl });
  const docs = await provider.search({ companyName: "Test Co", website: null });
  assert.equal(docs.length, RESEARCH_PROVIDER_LIMITS.maxDocumentsPerRun);
  assert.ok(docs[0].content.length <= RESEARCH_PROVIDER_LIMITS.maxContentChars + 20);
});
