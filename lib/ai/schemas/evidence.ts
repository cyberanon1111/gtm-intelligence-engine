import { z } from "zod";

export const CLAIM_TYPES = ["FACT", "INFERENCE", "RECOMMENDATION"] as const;

// The reusable evidence structure required across both agents: every
// externally-derived claim carries a source, a claim type (never presenting
// an inference as a verified fact), and a confidence — modeled once, shared
// by both the Research and Why-Now schemas.
export const evidenceItemSchema = z.object({
  sourceUrl: z.string().trim().min(1).optional(),
  sourceName: z.string().trim().min(1),
  publisher: z.string().trim().min(1).optional(),
  publishedAt: z.string().trim().min(1).optional(), // ISO date string, if known
  claim: z.string().trim().min(1),
  claimType: z.enum(CLAIM_TYPES),
  confidence: z.number().min(0).max(100),
});

export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
