import { ResearchProviderError, type ResearchProvider } from "@/lib/research-provider/types";

// The default "real" provider until a specific vendor (web search API,
// document/news aggregator, etc.) is wired in. It fails clearly rather than
// silently returning nothing indistinguishable from "found no results" — the
// research run records this as a skipped step, not a fabricated success.
// Swapping in a real vendor means writing one function that implements
// ResearchProvider and passing it into runResearchWorkflow — no change to
// any code that calls it.
export function createUnconfiguredResearchProvider(): ResearchProvider {
  return {
    async search() {
      throw new ResearchProviderError(
        "No external research provider is configured. Set RESEARCH_PROVIDER and its credentials (see .env.example), or implement ResearchProvider (lib/research-provider/types.ts) for a new vendor.",
        "NOT_CONFIGURED",
      );
    },
  };
}
