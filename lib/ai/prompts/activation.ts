import type { Account } from "@/lib/generated/prisma/client";
import type { ActivationChannelKey } from "@/config/meridian/activationChannels";
import type { ResearchResult } from "@/lib/ai/schemas/research";
import type { WhyNowResult } from "@/lib/ai/schemas/whyNow";

export interface ActivationEvidenceRef {
  id: string;
  claim: string;
  claimType: string;
  sourceName: string;
}

export interface ActivationScoreContext {
  total: number;
  matchedProblems: { problemKey: string; label: string; relevantProducts: { name: string }[] }[];
}

export interface ActivationPromptInput {
  channel: ActivationChannelKey;
  objective: string;
  account: Pick<Account, "companyName" | "companyType" | "country" | "fleetSize" | "status">;
  contact: { name: string; title: string | null; personaName: string | null } | null;
  score: ActivationScoreContext | null;
  whyNow: WhyNowResult | null;
  research: ResearchResult | null;
  evidence: ActivationEvidenceRef[];
}

const SHARED_RULES = `You are a GTM content drafting assistant for a maritime technology sales team. You draft ONE piece of content at a time, grounded strictly in the account intelligence you are given below — you have no other knowledge of this company.

Message principles, no exceptions:
- Be specific to this account — reference its actual situation, not a template that could apply to any company.
- Every factual claim must be grounded in the evidence, research, or signals given to you. If you state something as fact, you must be able to point to which given evidence/signal supports it.
- Reflect the relevant problem given to you — do not invent a different pitch.
- Never invent statistics, fleet counts, specific events, technologies, or compliance conditions that were not given to you.
- Never claim or imply private knowledge you could not actually have (internal decisions, unannounced plans, budgets, org changes not given to you).
- Never fabricate a customer relationship, a prior interaction, or an outcome ("your team told us...", "other operators like you have seen...", "we helped X achieve Y").
- Avoid fake personalization (name-dropping details that don't actually matter to the argument) and avoid generic filler like "I noticed your company is doing great things" — every sentence should be doing real work.
- When citing evidence, use ONLY the exact "id" values from the EVIDENCE list given to you below. Never invent an evidence id, and never cite an id not in that list.
- "confidence" (0-100) reflects how well-supported this draft is by the given evidence, not how persuasive you think it is.
- Respond with ONLY a single JSON object in the exact shape given at the end of this prompt — no markdown fences, no commentary before or after.`;

const CHANNEL_INSTRUCTIONS: Record<ActivationChannelKey, string> = {
  LINKEDIN: `Channel: LinkedIn message. Write a short (under ~80 words), specific, low-pressure message to the named contact. No hard sell. One clear, low-commitment CTA.`,
  EMAIL: `Channel: Email. Write a concise email (subject implied by "angle", body in "message") to the named contact. Professional, specific, one clear CTA. No hard sell.`,
  SALES_BRIEF: `Channel: Internal sales research brief. This is NOT outbound copy — it will never be sent to the account. It is a structured internal summary for the GTM team to use when preparing outreach or a call.`,
  CONTENT_RECOMMENDATION: `Channel: Content recommendation. This is a suggestion for content the marketing team could create — it does NOT get published automatically, and it is not addressed to the account.`,
};

const CONTENT_SHAPES: Record<ActivationChannelKey, string> = {
  LINKEDIN: `{ "angle": "string — the one idea this message leads with", "message": "string — the full message text", "cta": "string — the specific call to action" }`,
  EMAIL: `{ "angle": "string — used as the email subject/hook", "message": "string — the full email body", "cta": "string — the specific call to action" }`,
  SALES_BRIEF: `{ "whyNow": "string", "relevantSignals": ["string", "..."], "relevantProblem": "string", "potentialStakeholder": "string", "relevantProduct": "string", "suggestedOpening": "string — a suggested opening line for a call or email, for internal use" }`,
  CONTENT_RECOMMENDATION: `{ "targetProblem": "string", "targetPersona": "string", "contentAngle": "string", "suggestedFormat": "string — e.g. case study, one-pager, webinar", "supportingEvidenceSummary": "string", "suggestedCta": "string" }`,
};

export function buildActivationPrompt(input: ActivationPromptInput): { system: string; prompt: string } {
  const { channel, objective, account, contact, score, whyNow, research, evidence } = input;

  const system = `${SHARED_RULES}

${CHANNEL_INSTRUCTIONS[channel]}

Respond with ONLY this JSON shape:
{
  "objective": "string — restate the objective you were given",
  "reasoning": "string — why you drafted it this way, referencing the specific evidence/problem that justifies it",
  "evidenceUsed": ["evidence id", "..."],
  "confidence": 0-100,
  "content": ${CONTENT_SHAPES[channel]}
}`;

  const accountBlock = [
    `Company: ${account.companyName}`,
    `Company type: ${account.companyType ?? "unknown"}`,
    `Country: ${account.country ?? "unknown"}`,
    `Fleet size: ${account.fleetSize ?? "unknown"}`,
    `Pipeline status: ${account.status}`,
  ].join("\n");

  const contactBlock = contact
    ? `${contact.name}${contact.title ? `, ${contact.title}` : ""}${contact.personaName ? ` (persona: ${contact.personaName})` : ""}`
    : "(no specific contact — this is account-level/internal content)";

  const scoreBlock = score
    ? `Total GTM score: ${score.total}/100. Matched problems: ${
        score.matchedProblems.length
          ? score.matchedProblems
              .map((p) => `${p.label} -> ${p.relevantProducts.map((pr) => pr.name).join(", ") || "no mapped product"}`)
              .join("; ")
          : "none"
      }`
    : "This account has not been scored yet.";

  const whyNowBlock = whyNow
    ? `${whyNow.whyNow}\nRecommended next step (from GTM intelligence): ${whyNow.recommendedNextStep}`
    : "No Why-Now intelligence is available for this account yet.";

  const researchBlock = research
    ? [
        research.companySummary,
        research.fleetProfile,
        research.recentDevelopments.length ? `Recent developments: ${research.recentDevelopments.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "No research snapshot is available for this account yet.";

  const evidenceBlock = evidence.length
    ? evidence.map((e) => `- id: ${e.id} | [${e.claimType}] ${e.claim} (source: ${e.sourceName})`).join("\n")
    : "(no evidence on file — do not present any claim as a verified fact)";

  const prompt = `OBJECTIVE
${objective}

ACCOUNT
${accountBlock}

CONTACT
${contactBlock}

DETERMINISTIC SCORE
${scoreBlock}

WHY NOW (GTM intelligence)
${whyNowBlock}

RESEARCH SUMMARY
${researchBlock}

EVIDENCE (cite ONLY these ids in "evidenceUsed")
${evidenceBlock}

Produce the JSON now, following every rule in the system prompt exactly.`;

  return { system, prompt };
}
