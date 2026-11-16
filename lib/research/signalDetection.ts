import type { PrismaClient } from "@/lib/generated/prisma/client";
import { SIGNAL_DETECTION_RULES, type SignalDetectionRule } from "@/config/meridian/signalDetection";
import { getSignalTypeDefinition } from "@/config/meridian/signals";

export interface FactLike {
  statement: string;
  confidence: number | null;
  context?: string | null;
}

// Deterministic, config-driven, no fuzzy matching: a Fact's statement is
// tested for a case-insensitive substring match against each rule's
// keywords. A single fact can match multiple rules — every match is
// returned, not just the first.
export function detectSignalCandidates(
  fact: FactLike,
  rules: SignalDetectionRule[] = SIGNAL_DETECTION_RULES,
): SignalDetectionRule[] {
  const haystack = fact.statement.toLowerCase();
  return rules.filter((rule) => rule.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())));
}

export interface SignalIdentity {
  accountId: string;
  type: string;
  sourceId: string;
}

// The configurable "identity" for duplicate detection is (accountId, type,
// sourceId): if this exact source has already produced a signal of this
// exact type for this account, re-processing the same source (e.g. on a
// research refresh) must not create a second one. Deliberately exact-match,
// not fuzzy — see Phase 4.5 spec section 5. Replaceable: change what
// `identity` computes without touching call sites.
export async function isDuplicateSignal(db: PrismaClient, identity: SignalIdentity): Promise<boolean> {
  const existing = await db.evidence.findFirst({
    where: {
      sourceId: identity.sourceId,
      signal: { accountId: identity.accountId, type: identity.type },
    },
  });
  return !!existing;
}

export interface CreateSignalFromFactInput {
  accountId: string;
  sourceId: string;
  factId: string;
  detectedAt: Date;
  rule: SignalDetectionRule;
  fact: FactLike;
}

// Creates the Signal plus the Evidence row that ties it back to the Fact and
// Source that justified it — "never create a signal without evidence" is
// structural here, not just a convention: the Signal and its Evidence are
// created together, in one call.
export async function createSignalFromFact(db: PrismaClient, input: CreateSignalFromFactInput) {
  const typeDef = getSignalTypeDefinition(input.rule.signalType);

  const signal = await db.signal.create({
    data: {
      accountId: input.accountId,
      category: input.rule.category,
      type: input.rule.signalType,
      title: typeDef?.label ?? input.rule.signalType,
      description: input.fact.statement,
      detectedAt: input.detectedAt,
      strength: input.rule.defaultStrength,
      confidence: input.fact.confidence ?? 60,
      status: "ACTIVE",
    },
  });

  await db.evidence.create({
    data: {
      sourceId: input.sourceId,
      accountId: input.accountId,
      signalId: signal.id,
      factId: input.factId,
      claim: input.fact.statement,
      claimType: "FACT",
      confidence: input.fact.confidence,
    },
  });

  return signal;
}
