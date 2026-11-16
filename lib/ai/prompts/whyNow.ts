import type { Account } from "@/lib/generated/prisma/client";
import type { ResearchResult } from "@/lib/ai/schemas/research";

export interface WhyNowScoreContext {
  total: number;
  icpFit: number;
  signalStrength: number;
  problemRelevance: number;
  buyingPersona: number;
  engagement: number;
  matchedProblems: {
    problemKey: string;
    label: string;
    description: string;
    relevantProducts: { name: string }[];
  }[];
  matchedContacts: { name: string; personaName: string; seniorityTier: string }[];
}

export interface WhyNowPromptInput {
  account: Pick<Account, "companyName" | "companyType" | "country" | "fleetSize" | "status">;
  score: WhyNowScoreContext | null;
  research: ResearchResult | null;
  availablePersonas: string[];
  availableProducts: { name: string; description: string | null }[];
}

const SYSTEM_PROMPT = `You are a GTM (go-to-market) intelligence analyst for a maritime technology sales team. You interpret information that a deterministic scoring system has already computed — you do not compute scores yourself, and you must never contradict or restate a number differently than given.

Your job is INTERPRETATION, not fact-finding: explain in plain language why this account may be worth pursuing now, grounded strictly in the deterministic data given to you.

Rules, no exceptions:
- You may only reference a problem from the "matchedProblems" list given to you — never invent a new problem or problem key.
- You may only recommend a product from the "availableProducts" list given to you — never invent a product name.
- You may only reference a persona from the "availablePersonas" list given to you — never invent a persona name.
- When describing a contact or persona's relevance, you MUST use one of these exact phrases and nothing else: "relevant stakeholder", "potential stakeholder", "potential evaluator", "potential operational stakeholder". NEVER say "decision maker", "champion", or imply authority you have no evidence for — a title or persona assignment is not proof of buying authority.
- If there is no score yet, or no matched problems, say so plainly in "whyNow" rather than inventing urgency.
- recommendedNextStep must be a single concrete, low-commitment next action (e.g. "share a case study", "request an intro call with the DPA") — not a sales script.
- Respond with ONLY a single JSON object matching the exact shape below — no markdown fences, no commentary before or after.

{
  "whyNow": "string — plain-language synthesis of why this account matters now, or an honest statement that there isn't a strong reason yet",
  "potentialProblems": [{ "problemKey": "must match a given matchedProblems.problemKey", "label": "string", "rationale": "string" }],
  "relevantProducts": [{ "productName": "must match a given availableProducts name", "rationale": "string" }],
  "relevantPersonas": [{ "personaName": "must match a given availablePersonas entry", "rationale": "string", "stakeholderLabel": "relevant stakeholder" | "potential stakeholder" | "potential evaluator" | "potential operational stakeholder" }],
  "recommendedNextStep": "string",
  "confidence": 0-100,
  "supportingEvidence": [
    {
      "sourceUrl": "string, optional",
      "sourceName": "string, required (e.g. \\"Deterministic score\\", \\"Research snapshot\\")",
      "claim": "string, required",
      "claimType": "FACT" | "INFERENCE" | "RECOMMENDATION",
      "confidence": 0-100
    }
  ]
}`;

export function buildWhyNowPrompt(input: WhyNowPromptInput): { system: string; prompt: string } {
  const { account, score, research, availablePersonas, availableProducts } = input;

  const accountBlock = [
    `Company: ${account.companyName}`,
    `Company type: ${account.companyType ?? "unknown"}`,
    `Country: ${account.country ?? "unknown"}`,
    `Fleet size: ${account.fleetSize ?? "unknown"}`,
    `Pipeline status: ${account.status}`,
  ].join("\n");

  const scoreBlock = score
    ? [
        `Total GTM score: ${score.total}/100 (ICP Fit ${score.icpFit}/25, Signal Strength ${score.signalStrength}/25, Problem Relevance ${score.problemRelevance}/20, Buying Persona ${score.buyingPersona}/15, Engagement ${score.engagement}/15)`,
        `Matched problems: ${
          score.matchedProblems.length
            ? score.matchedProblems
                .map((p) => `${p.problemKey} ("${p.label}": ${p.description}) -> ${p.relevantProducts.map((pr) => pr.name).join(", ") || "no mapped product"}`)
                .join("; ")
            : "none matched"
        }`,
        `Matched buying-committee contacts: ${
          score.matchedContacts.length
            ? score.matchedContacts.map((c) => `${c.name} (${c.personaName}, ${c.seniorityTier})`).join("; ")
            : "none"
        }`,
      ].join("\n")
    : "This account has not been scored yet.";

  const researchBlock = research
    ? [
        `Company summary: ${research.companySummary}`,
        `Fleet profile: ${research.fleetProfile}`,
        `Recent developments: ${research.recentDevelopments.join("; ") || "none"}`,
        `Leadership changes: ${research.leadershipChanges.join("; ") || "none"}`,
        `Relevant compliance activity: ${research.relevantCompliance.join("; ") || "none"}`,
        `Technology signals: ${research.technologySignals.join("; ") || "none"}`,
      ].join("\n")
    : "No research snapshot is available for this account yet.";

  const prompt = `ACCOUNT
${accountBlock}

DETERMINISTIC SCORE (source of truth — do not recompute or contradict)
${scoreBlock}

RESEARCH SNAPSHOT
${researchBlock}

AVAILABLE PERSONAS (only reference these by exact name)
${availablePersonas.join(", ") || "(none configured)"}

AVAILABLE PRODUCTS (only reference these by exact name)
${availableProducts.map((p) => `${p.name}${p.description ? `: ${p.description}` : ""}`).join("; ") || "(none configured)"}

Produce the JSON report now, following every rule in the system prompt exactly.`;

  return { system: SYSTEM_PROMPT, prompt };
}
