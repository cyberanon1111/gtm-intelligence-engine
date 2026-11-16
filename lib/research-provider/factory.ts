import { DEFAULT_RESEARCH_PROVIDER, type ResearchProviderName } from "@/config/meridian/researchProvider";
import type { ResearchProvider } from "@/lib/research-provider/types";
import { createTavilyResearchProvider } from "@/lib/research-provider/tavilyProvider";
import { createUnconfiguredResearchProvider } from "@/lib/research-provider/unconfiguredProvider";

// The one place that knows which vendor is active. Selected by the
// RESEARCH_PROVIDER env var — adding a new vendor means adding one case here
// and one factory file; lib/research/researchRun.ts never changes.
export function createConfiguredResearchProvider(): ResearchProvider {
  const name = (process.env.RESEARCH_PROVIDER || DEFAULT_RESEARCH_PROVIDER) as ResearchProviderName;

  switch (name) {
    case "tavily":
      return createTavilyResearchProvider();
    case "unconfigured":
      return createUnconfiguredResearchProvider();
    default:
      return createUnconfiguredResearchProvider();
  }
}
