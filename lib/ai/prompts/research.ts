import type { Account, Contact, Persona, Signal } from "@/lib/generated/prisma/client";

export interface ResearchPromptInput {
  account: Pick<
    Account,
    "companyName" | "website" | "country" | "companyType" | "fleetSize" | "vesselTypes" | "regions" | "status"
  >;
  contacts: (Pick<Contact, "name" | "title" | "department"> & { persona: Pick<Persona, "name"> | null })[];
  signals: Pick<
    Signal,
    "category" | "type" | "title" | "description" | "sourceUrl" | "sourceName" | "detectedAt" | "confidence" | "strength"
  >[];
  currentScore: number | null;
}

const SYSTEM_PROMPT = `You are a B2B research analyst supporting a maritime technology sales team.

Your only job is to organize and summarize information that is explicitly given to you below into a structured report. You are NOT permitted to use any prior knowledge you may have about this specific company, its fleet, its people, or its history — the platform has no way to verify anything you didn't derive from the provided data, and an unverifiable claim presented as fact would be a serious defect.

Rules, no exceptions:
- Base every statement ONLY on the account fields and signals provided in the user message.
- If a section has no supporting signal or account data, respond with the exact literal string "UNKNOWN" for a text field, or an empty array for a list field. Do not guess, infer beyond the data, or pad with generic industry commentary.
- Every item in "evidence" must correspond to a specific signal you were given (reuse its sourceUrl/sourceName) or to the account record itself (sourceName: "Account record", no sourceUrl). Never invent a source.
- claimType must be "FACT" only for something directly stated in the provided data. Use "INFERENCE" for a reasonable synthesis you are drawing across multiple provided data points (e.g. "growing fleet size suggests expanding operational scale"). Never use "RECOMMENDATION" in this report.
- Respond with ONLY a single JSON object matching the exact shape below — no markdown fences, no commentary before or after.

{
  "companySummary": "string, or the literal \\"UNKNOWN\\"",
  "fleetProfile": "string, or the literal \\"UNKNOWN\\"",
  "recentDevelopments": ["string", "..."],
  "leadershipChanges": ["string", "..."],
  "relevantCompliance": ["string", "..."],
  "technologySignals": ["string", "..."],
  "evidence": [
    {
      "sourceUrl": "string, optional",
      "sourceName": "string, required",
      "publisher": "string, optional",
      "publishedAt": "ISO date string, optional",
      "claim": "string, required — the specific assertion this evidence supports",
      "claimType": "FACT" | "INFERENCE",
      "confidence": 0-100
    }
  ]
}`;

export function buildResearchPrompt(input: ResearchPromptInput): { system: string; prompt: string } {
  const { account, contacts, signals, currentScore } = input;

  const accountBlock = [
    `Company: ${account.companyName}`,
    `Website: ${account.website ?? "unknown"}`,
    `Country: ${account.country ?? "unknown"}`,
    `Company type: ${account.companyType ?? "unknown"}`,
    `Fleet size (vessels): ${account.fleetSize ?? "unknown"}`,
    `Vessel types: ${account.vesselTypes.length ? account.vesselTypes.join(", ") : "unknown"}`,
    `Regions: ${account.regions.length ? account.regions.join(", ") : "unknown"}`,
    `Pipeline status: ${account.status}`,
    `Current GTM score: ${currentScore ?? "not yet scored"}`,
  ].join("\n");

  const contactsBlock = contacts.length
    ? contacts
        .map(
          (c) =>
            `- ${c.name}${c.title ? `, ${c.title}` : ""}${c.department ? ` (${c.department})` : ""}${
              c.persona ? ` — persona: ${c.persona.name}` : ""
            }`,
        )
        .join("\n")
    : "(no contacts on file)";

  const signalsBlock = signals.length
    ? signals
        .map(
          (s) =>
            `- [${s.category}/${s.type}] "${s.title}" — ${s.description} (detected ${s.detectedAt.toISOString().slice(0, 10)}, confidence ${s.confidence}%, source: ${s.sourceName ?? "unspecified"}${s.sourceUrl ? ` <${s.sourceUrl}>` : ""})`,
        )
        .join("\n")
    : "(no signals on file)";

  const prompt = `ACCOUNT RECORD
${accountBlock}

KNOWN CONTACTS
${contactsBlock}

DETECTED SIGNALS (this is your only source of "recent" information — there is no live web access)
${signalsBlock}

Produce the JSON report now, following every rule in the system prompt exactly.`;

  return { system: SYSTEM_PROMPT, prompt };
}
