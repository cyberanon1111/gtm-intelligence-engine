import type { Activation, PrismaClient } from "@/lib/generated/prisma/client";
import { type AIClient, createAnthropicClient, RESEARCH_MODEL } from "@/lib/ai/client";
import { runActivationAgent } from "@/lib/ai/agents/activationAgent";
import { gatherActivationContext } from "@/lib/activation/context";
import { buildActivationContextSnapshot } from "@/lib/activation/snapshot";
import { extractAngleAndCta } from "@/lib/activation/angle";
import { ACTIVATION_PROMPT_VERSION } from "@/lib/ai/schemas/activation";
import type { ActivationChannelKey } from "@/config/meridian/activationChannels";

export interface GenerateActivationInput {
  accountId: string;
  contactId?: string | null;
  channel: ActivationChannelKey;
  objective: string;
}

export interface GenerateActivationDeps {
  aiClient?: AIClient;
}

// All-or-nothing: on success, creates exactly one new Activation row
// (status: DRAFT). On failure (insufficient context, AI error, malformed or
// invalid model output), throws and persists nothing — generation is a
// single synchronous call, unlike the multi-step ResearchRun pipeline, so
// there's no partial state worth recording as its own row.
//
// This function only ever reads Account/Contact/Score/AccountInsight/Signal/
// Evidence and writes exactly one Activation row — it never touches scoring,
// signals, facts, or research records (Phase 5 spec section 14).
export async function generateActivation(
  db: PrismaClient,
  input: GenerateActivationInput,
  deps: GenerateActivationDeps = {},
): Promise<Activation> {
  const aiClient = deps.aiClient ?? createAnthropicClient();

  const context = await gatherActivationContext(db, input.accountId, input.contactId ?? null);

  const result = await runActivationAgent(aiClient, {
    channel: input.channel,
    objective: input.objective,
    account: context.account,
    contact: context.contact
      ? {
          name: context.contact.name,
          title: context.contact.title,
          personaName: context.contact.persona?.name ?? null,
        }
      : null,
    score: context.score,
    whyNow: context.whyNow,
    research: context.research,
    evidence: context.evidence,
  });

  // Grounding: only keep evidence ids that actually exist for this account —
  // the model's self-reported citations are never trusted outright.
  const realEvidenceIds = new Set(context.evidence.map((e) => e.id));
  const groundedEvidenceIds = result.evidenceUsed.filter((id) => realEvidenceIds.has(id));

  const { angle, cta } = extractAngleAndCta(input.channel, result.content);
  const contextSnapshot = buildActivationContextSnapshot(context);

  return db.activation.create({
    data: {
      accountId: input.accountId,
      contactId: input.contactId ?? null,
      channel: input.channel,
      status: "DRAFT",
      objective: result.objective,
      content: result.content as never,
      angle,
      cta,
      reasoning: result.reasoning,
      evidenceIds: groundedEvidenceIds,
      sourceInsightId: context.sourceInsightId,
      contextSnapshot: contextSnapshot as never,
      provider: "anthropic",
      model: RESEARCH_MODEL,
      promptVersion: ACTIVATION_PROMPT_VERSION,
    },
  });
}
