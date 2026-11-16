import { AIResponseParseError } from "@/lib/ai/errors";

// Models sometimes wrap JSON in a markdown code fence, or add a stray
// sentence before/after it despite instructions not to. This extracts the
// outermost {...} block and parses it, rather than trusting the raw text
// verbatim — but it never repairs or guesses at malformed JSON; that still
// throws.
export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();

  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new AIResponseParseError("Model response did not contain a JSON object.", raw);
  }

  const jsonText = candidate.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new AIResponseParseError(
      `Model response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      raw,
    );
  }
}
