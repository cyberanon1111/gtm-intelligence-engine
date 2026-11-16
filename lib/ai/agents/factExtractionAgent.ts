import type { AIClient } from "@/lib/ai/client";
import { extractJson } from "@/lib/ai/extractJson";
import { AIResponseValidationError } from "@/lib/ai/errors";
import { buildFactExtractionPrompt, type FactExtractionPromptInput } from "@/lib/ai/prompts/factExtraction";
import { factExtractionResultSchema, type FactExtractionResult } from "@/lib/ai/schemas/factExtraction";

// Runs fact extraction over a single external document. Like the other
// agents, this rejects rather than coerces on a malformed/invalid response —
// see lib/ai/prompts/factExtraction.ts for how untrusted document content is
// isolated from instructions.
export async function runFactExtractionAgent(
  aiClient: AIClient,
  input: FactExtractionPromptInput,
): Promise<FactExtractionResult> {
  const { system, prompt } = buildFactExtractionPrompt(input);
  const raw = await aiClient.complete({ system, prompt, maxTokens: 1500 });
  const parsed = extractJson(raw);

  const result = factExtractionResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new AIResponseValidationError(
      "Fact extraction response failed schema validation.",
      raw,
      JSON.stringify(result.error.issues),
    );
  }

  return result.data;
}
