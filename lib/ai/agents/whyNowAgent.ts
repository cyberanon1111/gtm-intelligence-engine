import type { AIClient } from "@/lib/ai/client";
import { extractJson } from "@/lib/ai/extractJson";
import { AIResponseValidationError } from "@/lib/ai/errors";
import { buildWhyNowPrompt, type WhyNowPromptInput } from "@/lib/ai/prompts/whyNow";
import { whyNowResultSchema, type WhyNowResult } from "@/lib/ai/schemas/whyNow";

// Runs the Why-Now (GTM Intelligence) agent and returns a schema-validated,
// grounded result. Grounding is enforced twice: the prompt instructs the
// model to only reference given problems/products/personas, and this
// function then drops any item that doesn't actually match the deterministic
// context — never trusting the model's self-restraint alone. This is what
// keeps "AI system = what it means" from silently drifting into "AI system
// invents new facts."
export async function runWhyNowAgent(
  aiClient: AIClient,
  input: WhyNowPromptInput,
): Promise<WhyNowResult> {
  const { system, prompt } = buildWhyNowPrompt(input);
  const raw = await aiClient.complete({ system, prompt, maxTokens: 2000 });
  const parsed = extractJson(raw);

  const result = whyNowResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new AIResponseValidationError(
      "Why-Now agent response failed schema validation.",
      raw,
      JSON.stringify(result.error.issues),
    );
  }

  return groundResult(result.data, input);
}

function groundResult(result: WhyNowResult, input: WhyNowPromptInput): WhyNowResult {
  const validProblemKeys = new Set(input.score?.matchedProblems.map((p) => p.problemKey) ?? []);
  const validProductNames = new Set(input.availableProducts.map((p) => p.name));
  const validPersonaNames = new Set(input.availablePersonas);

  return {
    ...result,
    potentialProblems: result.potentialProblems.filter((p) => validProblemKeys.has(p.problemKey)),
    relevantProducts: result.relevantProducts.filter((p) => validProductNames.has(p.productName)),
    relevantPersonas: result.relevantPersonas.filter((p) => validPersonaNames.has(p.personaName)),
  };
}
