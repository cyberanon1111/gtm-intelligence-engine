// Bumping this invalidates comparisons against historical Score rows scored
// under a different algorithm version. It is a structural version of the
// engine itself, not MMS-specific configuration.
export const SCORING_ENGINE_VERSION = "v1";

// The 0-100 rubric shape (five dimensions, these specific caps) is a
// structural contract of the product — not a per-vertical assumption — so
// it's a constant here rather than configuration. What earns points *within*
// each cap is fully configurable (ICPRule / ScoringRule rows).
export const DIMENSION_MAX = {
  ICP_FIT: 25,
  SIGNAL_STRENGTH: 25,
  PROBLEM_RELEVANCE: 20,
  BUYING_PERSONA: 15,
  ENGAGEMENT: 15,
} as const;

export const TOTAL_MAX = Object.values(DIMENSION_MAX).reduce((a, b) => a + b, 0);
