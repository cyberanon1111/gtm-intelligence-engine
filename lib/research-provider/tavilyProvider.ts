import { RESEARCH_PROVIDER_LIMITS } from "@/config/meridian/researchProvider";
import { ResearchProviderError, type ResearchProvider, type RetrievedDocument } from "@/lib/research-provider/types";

// Tavily (https://tavily.com) — a search API built for AI/agent use cases:
// a single REST call, results already come back as {url, title, content,
// published_date}, which is why it's a comfortable fit for this interface.
// Nothing outside this file knows it's Tavily specifically — see
// lib/research-provider/factory.ts for how it's selected, and
// lib/research/researchRun.ts, which only ever calls `.search()`.

interface TavilySearchResultItem {
  url: string;
  title: string;
  content: string;
  score?: number;
  published_date?: string;
}

interface TavilySearchResponse {
  results?: TavilySearchResultItem[];
}

type FetchLike = typeof fetch;

function truncate(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars) + "\n\n[truncated]";
}

async function fetchWithRetry(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  retries: number,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchImpl(url, init);
    } catch (error) {
      lastError = error;
      if (attempt < retries) continue;
    }
  }
  throw lastError;
}

export function createTavilyResearchProvider(deps: { fetchImpl?: FetchLike } = {}): ResearchProvider {
  const fetchImpl = deps.fetchImpl ?? fetch;

  return {
    async search({ companyName }) {
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        throw new ResearchProviderError("TAVILY_API_KEY is not configured.", "NOT_CONFIGURED");
      }

      const query = `${companyName} maritime shipping fleet news`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), RESEARCH_PROVIDER_LIMITS.requestTimeoutMs);

      let response: Response;
      try {
        response = await fetchWithRetry(
          fetchImpl,
          "https://api.tavily.com/search",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: apiKey,
              query,
              max_results: RESEARCH_PROVIDER_LIMITS.maxDocumentsPerRun,
              search_depth: "basic",
            }),
            signal: controller.signal,
          },
          RESEARCH_PROVIDER_LIMITS.retryCount,
        );
      } catch (error) {
        if (controller.signal.aborted) {
          throw new ResearchProviderError("Tavily request timed out.", "TIMEOUT", { cause: error });
        }
        throw new ResearchProviderError("Tavily request failed.", "UNAVAILABLE", { cause: error });
      } finally {
        clearTimeout(timeout);
      }

      if (response.status === 401 || response.status === 403) {
        throw new ResearchProviderError("Tavily authentication failed — check TAVILY_API_KEY.", "AUTH");
      }
      if (response.status === 429) {
        throw new ResearchProviderError("Tavily rate limit exceeded.", "RATE_LIMIT");
      }
      if (response.status >= 500) {
        throw new ResearchProviderError(
          `Tavily is unavailable (status ${response.status}).`,
          "UNAVAILABLE",
        );
      }
      if (!response.ok) {
        throw new ResearchProviderError(`Tavily request failed with status ${response.status}.`, "UNKNOWN");
      }

      let data: TavilySearchResponse;
      try {
        data = await response.json();
      } catch (error) {
        throw new ResearchProviderError(
          "Tavily returned a malformed (non-JSON) response.",
          "MALFORMED_RESPONSE",
          { cause: error },
        );
      }

      if (!Array.isArray(data.results)) {
        throw new ResearchProviderError(
          "Tavily response did not contain a results array.",
          "MALFORMED_RESPONSE",
        );
      }

      const documents: RetrievedDocument[] = data.results
        .filter((r) => typeof r.url === "string" && typeof r.content === "string")
        .slice(0, RESEARCH_PROVIDER_LIMITS.maxDocumentsPerRun)
        .map((r) => ({
          url: r.url,
          title: r.title || r.url,
          publishedAt: r.published_date,
          retrievedAt: new Date().toISOString(),
          content: truncate(r.content, RESEARCH_PROVIDER_LIMITS.maxContentChars),
        }));

      return documents; // an empty array here is a valid, successful "found nothing" — never an error
    },
  };
}
