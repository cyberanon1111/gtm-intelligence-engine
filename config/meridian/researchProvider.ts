// Research budget/limits — deliberately generic (no vendor-specific
// concepts), so the same config governs whichever ResearchProvider is
// configured. Enforced in the orchestration layer (lib/research/researchRun.ts),
// not inside any specific provider implementation.

export const RESEARCH_PROVIDER_LIMITS = {
  // How many search queries a single research run is allowed to issue.
  // The current provider implementations issue exactly one, but this caps
  // future multi-query providers too.
  maxSearchesPerRun: 1,

  // How many documents a run will process, regardless of how many a
  // provider returns. Extra results are dropped (preferring the highest
  // source-quality ones — see lib/research/sourceQuality.ts), not an error.
  maxDocumentsPerRun: 5,

  // Documents are truncated to this many characters before ever reaching a
  // prompt — a budget control and a security control (see lib/ai/prompts/factExtraction.ts).
  maxContentChars: 8000,

  // Abort a single provider request after this long.
  requestTimeoutMs: 15_000,

  // Retries for a transient failure (network error, 5xx, timeout) before
  // giving up on external retrieval for this run. Authentication and rate
  // limit errors are not retried — retrying won't fix them.
  retryCount: 2,
} as const;

// How long since the last completed/partial/skipped research run before a
// new "Research Account" click is treated as stale and allowed to run again
// without the user explicitly forcing it. "Refresh Research" always bypasses
// this regardless of age.
export const RESEARCH_FRESHNESS_WINDOW_HOURS = 24;

// Which vendor createConfiguredResearchProvider() selects, via the
// RESEARCH_PROVIDER env var. Adding a vendor means adding one entry here and
// one factory function — nothing in lib/research/ changes.
export const RESEARCH_PROVIDER_NAMES = ["tavily", "unconfigured"] as const;
export type ResearchProviderName = (typeof RESEARCH_PROVIDER_NAMES)[number];
export const DEFAULT_RESEARCH_PROVIDER: ResearchProviderName = "unconfigured";
