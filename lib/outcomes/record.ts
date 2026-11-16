import { z } from "zod";
import type { OutcomeEvent, PrismaClient } from "@/lib/generated/prisma/client";
import { OUTCOME_EVENT_TYPES, type OutcomeEventTypeKey } from "@/config/meridian/outcomeTypes";

export class OutcomeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutcomeValidationError";
  }
}

const outcomeMetadataSchema = z
  .object({
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()
  .nullable();

const recordOutcomeInputSchema = z.object({
  accountId: z.string().trim().min(1),
  contactId: z.string().trim().min(1).nullable().optional(),
  activationId: z.string().trim().min(1).nullable().optional(),
  type: z.enum(OUTCOME_EVENT_TYPES.map((t) => t.key) as [OutcomeEventTypeKey, ...OutcomeEventTypeKey[]]),
  occurredAt: z.date(),
  metadata: outcomeMetadataSchema.optional(),
});

export type RecordOutcomeInput = z.infer<typeof recordOutcomeInputSchema>;

// Every relationship is verified server-side against the database — the
// client's accountId/contactId/activationId are never trusted outright
// (Phase 6 section 12). A contact must actually belong to the given account;
// an activation must actually belong to the given account (and, if a contact
// is also given, that contact must belong to the same account) — this is
// what makes "attach an event to an unrelated activation" impossible rather
// than just discouraged.
export async function recordOutcomeEvent(db: PrismaClient, rawInput: unknown): Promise<OutcomeEvent> {
  const input = recordOutcomeInputSchema.parse(rawInput);

  const account = await db.account.findUnique({ where: { id: input.accountId } });
  if (!account) {
    throw new OutcomeValidationError(`No such account: ${input.accountId}`);
  }

  if (input.contactId) {
    const contact = await db.contact.findUnique({ where: { id: input.contactId } });
    if (!contact || contact.accountId !== input.accountId) {
      throw new OutcomeValidationError("The given contact does not belong to the given account.");
    }
  }

  if (input.activationId) {
    const activation = await db.activation.findUnique({ where: { id: input.activationId } });
    if (!activation || activation.accountId !== input.accountId) {
      throw new OutcomeValidationError("The given activation does not belong to the given account.");
    }
  }

  // Append-only: this is the only write this function performs. It never
  // touches Fact/Source/Signal/Score/AccountInsight/Activation rows (Phase 6
  // section 10) — recording an outcome is purely additive.
  return db.outcomeEvent.create({
    data: {
      accountId: input.accountId,
      contactId: input.contactId ?? null,
      activationId: input.activationId ?? null,
      type: input.type,
      occurredAt: input.occurredAt,
      source: "manual", // the only source today — no external capture integration exists yet
      metadata: input.metadata ?? undefined,
    },
  });
}
