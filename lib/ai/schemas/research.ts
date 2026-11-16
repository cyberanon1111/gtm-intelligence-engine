import { z } from "zod";
import { evidenceItemSchema } from "@/lib/ai/schemas/evidence";

// The literal string the model must use when a section has no supporting
// evidence in the signals/account data it was given — never invented filler.
export const UNKNOWN = "UNKNOWN";

const narrativeField = z.string().trim().min(1);
const listField = z.array(z.string().trim().min(1));

export const researchResultSchema = z.object({
  companySummary: narrativeField,
  fleetProfile: narrativeField,
  recentDevelopments: listField,
  leadershipChanges: listField,
  relevantCompliance: listField,
  technologySignals: listField,
  evidence: z.array(evidenceItemSchema),
});

export type ResearchResult = z.infer<typeof researchResultSchema>;

export const RESEARCH_PROMPT_VERSION = "research-v1";
