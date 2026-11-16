import { z } from "zod";
import { evidenceItemSchema } from "@/lib/ai/schemas/evidence";

// Wording the model is constrained to when describing a contact/persona's
// relevance — never "decision maker" unless explicit evidence exists (there
// rarely is any at this stage), so the vocabulary itself enforces the rule.
export const STAKEHOLDER_LABELS = [
  "relevant stakeholder",
  "potential stakeholder",
  "potential evaluator",
  "potential operational stakeholder",
] as const;

export const whyNowResultSchema = z.object({
  whyNow: z.string().trim().min(1),
  potentialProblems: z.array(
    z.object({
      problemKey: z.string().trim().min(1),
      label: z.string().trim().min(1),
      rationale: z.string().trim().min(1),
    }),
  ),
  relevantProducts: z.array(
    z.object({
      productName: z.string().trim().min(1),
      rationale: z.string().trim().min(1),
    }),
  ),
  relevantPersonas: z.array(
    z.object({
      personaName: z.string().trim().min(1),
      rationale: z.string().trim().min(1),
      stakeholderLabel: z.enum(STAKEHOLDER_LABELS),
    }),
  ),
  recommendedNextStep: z.string().trim().min(1),
  confidence: z.number().min(0).max(100),
  supportingEvidence: z.array(evidenceItemSchema),
});

export type WhyNowResult = z.infer<typeof whyNowResultSchema>;

export const WHY_NOW_PROMPT_VERSION = "why-now-v1";
