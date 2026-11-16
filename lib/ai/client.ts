import Anthropic from "@anthropic-ai/sdk";
import { AIProviderError } from "@/lib/ai/errors";

// Thin seam between the agents and the actual model provider. Tests inject a
// fake implementation of this interface, so the agent/pipeline logic never
// needs a live API key or network access to be exercised — only the real
// factory below (createAnthropicClient) touches the network.
export interface AIClient {
  complete(input: { system: string; prompt: string; maxTokens?: number }): Promise<string>;
}

export const RESEARCH_MODEL = "claude-sonnet-5";
const REQUEST_TIMEOUT_MS = 45_000;

export function createAnthropicClient(): AIClient {
  return {
    async complete({ system, prompt, maxTokens = 2000 }) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new AIProviderError("ANTHROPIC_API_KEY is not configured.");
      }

      const anthropic = new Anthropic({ apiKey });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await anthropic.messages.create(
          {
            model: RESEARCH_MODEL,
            max_tokens: maxTokens,
            system,
            messages: [{ role: "user", content: prompt }],
          },
          { signal: controller.signal },
        );

        const textBlock = response.content.find((block) => block.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          throw new AIProviderError("Model response contained no text content.");
        }
        return textBlock.text;
      } catch (error) {
        if (error instanceof AIProviderError) throw error;
        if (controller.signal.aborted) {
          throw new AIProviderError("Request to the model timed out.", { cause: error });
        }
        throw new AIProviderError(
          error instanceof Error ? error.message : "Unknown error calling the model provider.",
          { cause: error },
        );
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
