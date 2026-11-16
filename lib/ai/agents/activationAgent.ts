import type { AIClient } from "@/lib/ai/client";
import { extractJson } from "@/lib/ai/extractJson";
import { AIResponseValidationError } from "@/lib/ai/errors";
import { buildActivationPrompt, type ActivationPromptInput } from "@/lib/ai/prompts/activation";
import { getActivationResultSchema, type ActivationResult } from "@/lib/ai/schemas/activation";

// Runs the Activation Agent and returns a schema-validated result. Grounding
// (dropping any evidenceUsed id that doesn't correspond to real evidence for
// this account) happens one layer up, in lib/activation/generate.ts, which
// is also where the required-context precondition ("do not generate from
// account name alone") is enforced — this function is a pure
// (aiClient, input) -> result call with no DB access of its own.
export async function runActivationAgent(
  aiClient: AIClient,
  input: ActivationPromptInput,
): Promise<ActivationResult> {
  const { system, prompt } = buildActivationPrompt(input);
  const raw = await aiClient.complete({ system, prompt, maxTokens: 1500 });
  const parsed = extractJson(raw);

  const schema = getActivationResultSchema(input.channel);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AIResponseValidationError(
      "Activation agent response failed schema validation.",
      raw,
      JSON.stringify(result.error.issues),
    );
  }

  return result.data;
}
