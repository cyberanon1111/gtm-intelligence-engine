import { z } from "zod";

export const extractedFactSchema = z.object({
  statement: z.string().trim().min(1),
  confidence: z.number().min(0).max(100),
  context: z.string().trim().min(1).optional(), // date/context when available
});

export const factExtractionResultSchema = z.object({
  facts: z.array(extractedFactSchema),
});

export type ExtractedFact = z.infer<typeof extractedFactSchema>;
export type FactExtractionResult = z.infer<typeof factExtractionResultSchema>;

export const FACT_EXTRACTION_PROMPT_VERSION = "fact-extraction-v1";
