import type { Signal } from "@/lib/generated/prisma/client";
import { PROBLEMS, SIGNAL_TYPE_TO_PROBLEMS, PROBLEM_TO_PRODUCTS } from "@/config/meridian/problems";
import { DIMENSION_MAX } from "@/lib/scoring/constants";
import type { ProblemRelevanceConfig } from "@/lib/scoring/configSchemas";
import type { MatchedProblem, ProblemRelevanceDetail } from "@/lib/scoring/types";

export interface ProductRef {
  id: string;
  name: string;
}

// Considers every signal on the account (any category) — a compliance
// signal is evidence of a problem regardless of how it scores under Signal
// Strength.
export function computeProblemRelevance(
  signals: Signal[],
  config: ProblemRelevanceConfig,
  products: ProductRef[],
): { points: number; detail: ProblemRelevanceDetail } {
  const evidenceByProblem = new Map<string, string[]>();

  for (const signal of signals) {
    const problemKeys = SIGNAL_TYPE_TO_PROBLEMS[signal.type] ?? [];
    for (const key of problemKeys) {
      const existing = evidenceByProblem.get(key) ?? [];
      existing.push(signal.id);
      evidenceByProblem.set(key, existing);
    }
  }

  const matchedProblems: MatchedProblem[] = [...evidenceByProblem.entries()].map(
    ([problemKey, evidenceSignalIds]) => {
      const def = PROBLEMS.find((p) => p.key === problemKey);
      const productNames = PROBLEM_TO_PRODUCTS[problemKey] ?? [];
      const relevantProducts = products
        .filter((p) => productNames.includes(p.name))
        .map((p) => ({ id: p.id, name: p.name }));

      return {
        problemKey,
        label: def?.label ?? problemKey,
        description: def?.description ?? "",
        evidenceSignalIds,
        relevantProducts,
      };
    },
  );

  const countedMatches = Math.min(matchedProblems.length, config.maxMatches);
  const rawPoints = countedMatches * config.pointsPerMatchedProblem;
  const points = Math.min(Math.round(rawPoints), DIMENSION_MAX.PROBLEM_RELEVANCE);

  return { points, detail: { matchedProblems, countedMatches } };
}
