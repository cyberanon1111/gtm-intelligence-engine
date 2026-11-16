import type { PrismaClient } from "@/lib/generated/prisma/client";
import { parseActivationContextSnapshot } from "@/lib/activation/snapshot";
import type { OutcomeEventTypeKey } from "@/config/meridian/outcomeTypes";

export interface AnalyticsBucket {
  key: string;
  accounts: number;
  activations: number;
  sentActivations: number;
  replies: number;
  positiveReplies: number;
  meetings: number;
  opportunities: number;
  // Descriptive rates only (percentages, 0 when there's no denominator) —
  // never used to rank buckets against each other (Phase 6 section 7).
  replyRatePct: number | null;
  positiveReplyRatePct: number | null;
  meetingRatePct: number | null;
}

export interface GtmAnalytics {
  byChannel: AnalyticsBucket[];
  byAngle: AnalyticsBucket[];
  bySignalType: AnalyticsBucket[];
  byPersona: AnalyticsBucket[];
  byProduct: AnalyticsBucket[];
}

const REPLY_TYPES: OutcomeEventTypeKey[] = ["REPLIED", "POSITIVE_REPLY", "NEGATIVE_REPLY"];

interface BucketAccumulator {
  accountIds: Set<string>;
  activationIds: Set<string>;
  sentActivationIds: Set<string>;
  replies: number;
  positiveReplies: number;
  meetings: number;
  opportunities: number;
}

function newAccumulator(): BucketAccumulator {
  return {
    accountIds: new Set(),
    activationIds: new Set(),
    sentActivationIds: new Set(),
    replies: 0,
    positiveReplies: 0,
    meetings: 0,
    opportunities: 0,
  };
}

function finalizeBucket(key: string, acc: BucketAccumulator): AnalyticsBucket {
  const sent = acc.sentActivationIds.size;
  const rate = (n: number) => (sent > 0 ? Math.round((n / sent) * 1000) / 10 : null);
  return {
    key,
    accounts: acc.accountIds.size,
    activations: acc.activationIds.size,
    sentActivations: sent,
    replies: acc.replies,
    positiveReplies: acc.positiveReplies,
    meetings: acc.meetings,
    opportunities: acc.opportunities,
    replyRatePct: rate(acc.replies),
    positiveReplyRatePct: rate(acc.positiveReplies),
    meetingRatePct: rate(acc.meetings),
  };
}

export interface GtmAnalyticsFilter {
  // Restricts aggregation to specific accounts — the global /analytics page
  // omits this (aggregates everything), while callers that need a
  // deterministic, isolated view (an account-scoped panel, or a test) can
  // scope it precisely instead of reading the whole table.
  accountIds?: string[];
}

// Descriptive, factual aggregation only — reads real Activation/OutcomeEvent
// rows and counts them. Never ranks buckets as "best"/"worst" (Phase 6
// section 7); the UI must present these as a plain table, not a leaderboard.
export async function computeGtmAnalytics(db: PrismaClient, filter: GtmAnalyticsFilter = {}): Promise<GtmAnalytics> {
  const accountFilter = filter.accountIds ? { accountId: { in: filter.accountIds } } : {};

  const [activations, outcomes] = await Promise.all([
    db.activation.findMany({
      where: accountFilter,
      select: { id: true, accountId: true, channel: true, angle: true, status: true, contextSnapshot: true },
    }),
    db.outcomeEvent.findMany({
      where: { activationId: { not: null }, ...accountFilter },
      select: { activationId: true, type: true },
    }),
  ]);

  const outcomesByActivation = new Map<string, OutcomeEventTypeKey[]>();
  for (const o of outcomes) {
    if (!o.activationId) continue;
    const list = outcomesByActivation.get(o.activationId) ?? [];
    list.push(o.type as OutcomeEventTypeKey);
    outcomesByActivation.set(o.activationId, list);
  }

  function buildDimension(getKeys: (a: (typeof activations)[number]) => string[]): AnalyticsBucket[] {
    const buckets = new Map<string, BucketAccumulator>();

    for (const activation of activations) {
      const keys = getKeys(activation);
      if (keys.length === 0) continue;

      const eventTypes = outcomesByActivation.get(activation.id) ?? [];
      for (const key of keys) {
        const acc = buckets.get(key) ?? newAccumulator();
        acc.accountIds.add(activation.accountId);
        acc.activationIds.add(activation.id);
        if (activation.status === "SENT") acc.sentActivationIds.add(activation.id);
        for (const type of eventTypes) {
          if (REPLY_TYPES.includes(type)) acc.replies += 1;
          if (type === "POSITIVE_REPLY") acc.positiveReplies += 1;
          if (type === "MEETING_BOOKED") acc.meetings += 1;
          if (type === "OPPORTUNITY_CREATED") acc.opportunities += 1;
        }
        buckets.set(key, acc);
      }
    }

    return Array.from(buckets.entries())
      .map(([key, acc]) => finalizeBucket(key, acc))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  const byChannel = buildDimension((a) => [a.channel]);
  const byAngle = buildDimension((a) => (a.angle ? [a.angle] : []));

  const bySignalType = buildDimension((a) => {
    const snapshot = parseActivationContextSnapshot(a.contextSnapshot);
    const details = snapshot?.score?.componentDetails as
      | { signalStrength?: { signals?: { type: string }[] } }
      | undefined;
    const types = details?.signalStrength?.signals?.map((s) => s.type) ?? [];
    return Array.from(new Set(types));
  });

  const byPersona = buildDimension((a) => {
    const snapshot = parseActivationContextSnapshot(a.contextSnapshot);
    return snapshot?.contact?.personaName ? [snapshot.contact.personaName] : [];
  });

  const byProduct = buildDimension((a) => {
    const snapshot = parseActivationContextSnapshot(a.contextSnapshot);
    const details = snapshot?.score?.componentDetails as
      | { problemRelevance?: { matchedProblems?: { relevantProducts?: { name: string }[] }[] } }
      | undefined;
    const names =
      details?.problemRelevance?.matchedProblems?.flatMap((p) => p.relevantProducts?.map((pr) => pr.name) ?? []) ?? [];
    return Array.from(new Set(names));
  });

  return { byChannel, byAngle, bySignalType, byPersona, byProduct };
}
