import type { AIClient } from "@/lib/ai/client";
import { extractJson } from "@/lib/ai/extractJson";
import { AIResponseValidationError } from "@/lib/ai/errors";
import { buildResearchPrompt, type ResearchPromptInput } from "@/lib/ai/prompts/research";
import { researchResultSchema, type ResearchResult } from "@/lib/ai/schemas/research";

// Runs the AI Research Agent and returns a schema-validated result, or
// throws (AIProviderError from the client, AIResponseParseError, or
// AIResponseValidationError below) — it never returns a partially-coerced
// or best-effort result. Callers (the pipeline) are responsible for turning
// a thrown error into a FAILED AccountInsight row.
export async function runResearchAgent(
  aiClient: AIClient,
  input: ResearchPromptInput,
): Promise<ResearchResult> {
  const { system, prompt } = buildResearchPrompt(input);
  const raw = await aiClient.complete({ system, prompt, maxTokens: 2000 });
  const parsed = extractJson(raw);

  const result = researchResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new AIResponseValidationError(
      "Research agent response failed schema validation.",
      raw,
      JSON.stringify(result.error.issues),
    );
  }

  return result.data;
}
