import { z } from "zod";

// Shared envelope every channel's output includes (section 4 of the Phase 5
// spec). `evidenceUsed` is the model's claimed list of Evidence.id values —
// it is re-validated against the account's real evidence at generation time
// (lib/activation/generate.ts) and hallucinated ids are dropped; this schema
// only checks shape, not truth.
const envelopeFields = {
  objective: z.string().trim().min(1),
  reasoning: z.string().trim().min(1),
  evidenceUsed: z.array(z.string().trim().min(1)),
  confidence: z.number().min(0).max(100),
};

// LINKEDIN / EMAIL — outbound copy addressed to a specific contact.
export const outboundContentSchema = z.object({
  angle: z.string().trim().min(1),
  message: z.string().trim().min(1),
  cta: z.string().trim().min(1),
});

// SALES_BRIEF — internal intelligence, not outbound copy (section 12).
export const salesBriefContentSchema = z.object({
  whyNow: z.string().trim().min(1),
  relevantSignals: z.array(z.string().trim().min(1)),
  relevantProblem: z.string().trim().min(1),
  potentialStakeholder: z.string().trim().min(1),
  relevantProduct: z.string().trim().min(1),
  suggestedOpening: z.string().trim().min(1),
});

// CONTENT_RECOMMENDATION — a suggestion, never auto-published (section 13).
export const contentRecommendationContentSchema = z.object({
  targetProblem: z.string().trim().min(1),
  targetPersona: z.string().trim().min(1),
  contentAngle: z.string().trim().min(1),
  suggestedFormat: z.string().trim().min(1),
  supportingEvidenceSummary: z.string().trim().min(1),
  suggestedCta: z.string().trim().min(1),
});

export const linkedinResultSchema = z.object({ ...envelopeFields, content: outboundContentSchema });
export const emailResultSchema = z.object({ ...envelopeFields, content: outboundContentSchema });
export const salesBriefResultSchema = z.object({ ...envelopeFields, content: salesBriefContentSchema });
export const contentRecommendationResultSchema = z.object({
  ...envelopeFields,
  content: contentRecommendationContentSchema,
});

export type LinkedinResult = z.infer<typeof linkedinResultSchema>;
export type EmailResult = z.infer<typeof emailResultSchema>;
export type SalesBriefResult = z.infer<typeof salesBriefResultSchema>;
export type ContentRecommendationResult = z.infer<typeof contentRecommendationResultSchema>;
export type ActivationResult = LinkedinResult | EmailResult | SalesBriefResult | ContentRecommendationResult;
export type ActivationContent = ActivationResult["content"];

export function getActivationResultSchema(channel: string) {
  switch (channel) {
    case "LINKEDIN":
      return linkedinResultSchema;
    case "EMAIL":
      return emailResultSchema;
    case "SALES_BRIEF":
      return salesBriefResultSchema;
    case "CONTENT_RECOMMENDATION":
      return contentRecommendationResultSchema;
    default:
      throw new Error(`Unknown activation channel: ${channel}`);
  }
}

// Just the `content` shape, for validating a human edit before it's saved —
// separate from getActivationResultSchema, which validates the full AI
// output envelope (objective/reasoning/evidenceUsed/confidence too).
export function getActivationContentSchema(channel: string) {
  switch (channel) {
    case "LINKEDIN":
    case "EMAIL":
      return outboundContentSchema;
    case "SALES_BRIEF":
      return salesBriefContentSchema;
    case "CONTENT_RECOMMENDATION":
      return contentRecommendationContentSchema;
    default:
      throw new Error(`Unknown activation channel: ${channel}`);
  }
}

export const ACTIVATION_PROMPT_VERSION = "activation-v1";
