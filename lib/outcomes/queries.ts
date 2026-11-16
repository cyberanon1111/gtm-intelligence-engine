import type { OutcomeEvent, Account, Contact, Activation, PrismaClient } from "@/lib/generated/prisma/client";
import type { OutcomeEventTypeKey } from "@/config/meridian/outcomeTypes";
import type { ActivationChannelKey } from "@/config/meridian/activationChannels";
import { parseActivationContextSnapshot } from "@/lib/activation/snapshot";

export interface OutcomeEventFilters {
  type?: OutcomeEventTypeKey;
  channel?: ActivationChannelKey;
  accountId?: string;
  personaName?: string;
  productName?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export type OutcomeEventWithContext = OutcomeEvent & {
  account: Pick<Account, "id" | "companyName">;
  contact: Pick<Contact, "id" | "name"> | null;
  activation: Pick<Activation, "id" | "channel" | "angle" | "objective" | "contextSnapshot"> | null;
};

// Reads real rows only — every count/list here comes straight from the
// database, never a fabricated or placeholder figure (Phase 6 section 6).
// persona/product filtering reads the activation's frozen contextSnapshot
// (not the account's current contacts/products) since that's the durable
// attribution surface Phase 6 is built on; this is post-query JS filtering
// (not a DB-level JSON query) which is fine at this app's demo scale.
export async function listOutcomeEvents(
  db: PrismaClient,
  filters: OutcomeEventFilters = {},
): Promise<OutcomeEventWithContext[]> {
  const rows = await db.outcomeEvent.findMany({
    where: {
      type: filters.type,
      accountId: filters.accountId,
      occurredAt: {
        gte: filters.dateFrom,
        lte: filters.dateTo,
      },
      ...(filters.channel ? { activation: { channel: filters.channel } } : {}),
    },
    include: {
      account: { select: { id: true, companyName: true } },
      contact: { select: { id: true, name: true } },
      activation: { select: { id: true, channel: true, angle: true, objective: true, contextSnapshot: true } },
    },
    orderBy: { occurredAt: "desc" },
  });

  if (!filters.personaName && !filters.productName) return rows;

  return rows.filter((row) => {
    const snapshot = parseActivationContextSnapshot(row.activation?.contextSnapshot);
    if (filters.personaName) {
      if (snapshot?.contact?.personaName !== filters.personaName) return false;
    }
    if (filters.productName) {
      const products =
        (snapshot?.score?.componentDetails as { problemRelevance?: { matchedProblems?: { relevantProducts?: { name: string }[] }[] } } | undefined)
          ?.problemRelevance?.matchedProblems?.flatMap((p) => p.relevantProducts?.map((pr) => pr.name) ?? []) ?? [];
      if (!products.includes(filters.productName)) return false;
    }
    return true;
  });
}
