import type { Activation, PrismaClient } from "@/lib/generated/prisma/client";
import { assertTransition, type ActivationStatusValue } from "@/lib/activation/statusTransitions";
import { getActivationContentSchema } from "@/lib/ai/schemas/activation";
import { extractAngleAndCta } from "@/lib/activation/angle";
import type { ActivationChannelKey } from "@/config/meridian/activationChannels";

async function transitionActivation(
  db: PrismaClient,
  activationId: string,
  to: ActivationStatusValue,
  extraData: Record<string, unknown> = {},
): Promise<Activation> {
  const activation = await db.activation.findUniqueOrThrow({ where: { id: activationId } });
  assertTransition(activation.status as ActivationStatusValue, to);
  return db.activation.update({ where: { id: activationId }, data: { status: to, ...extraData } });
}

export async function submitForReview(db: PrismaClient, activationId: string): Promise<Activation> {
  return transitionActivation(db, activationId, "PENDING_REVIEW");
}

// Approval is always an explicit, attributable human action — approvedAt/By
// are set here and nowhere else.
export async function approveActivation(
  db: PrismaClient,
  activationId: string,
  approvedBy?: string,
): Promise<Activation> {
  return transitionActivation(db, activationId, "APPROVED", {
    approvedAt: new Date(),
    approvedBy: approvedBy ?? null,
  });
}

// A rejected activation has no outgoing transitions (see statusTransitions.ts)
// — it can never subsequently become sendable.
export async function rejectActivation(db: PrismaClient, activationId: string): Promise<Activation> {
  return transitionActivation(db, activationId, "REJECTED", { rejectedAt: new Date() });
}

// Deliberately makes no external call — Phase 5 has no sending integration.
// This only records that a human marked it sent; SENT is reachable only
// from APPROVED (enforced by assertTransition), so "sent without approved"
// is structurally impossible, not just conventionally avoided.
export async function markActivationSent(db: PrismaClient, activationId: string): Promise<Activation> {
  return transitionActivation(db, activationId, "SENT", { sentAt: new Date() });
}

export async function cancelActivation(db: PrismaClient, activationId: string): Promise<Activation> {
  return transitionActivation(db, activationId, "CANCELLED");
}

export class ActivationNotEditableError extends Error {
  constructor(status: string) {
    super(`Cannot edit an activation with status ${status}.`);
    this.name = "ActivationNotEditableError";
  }
}

// Editing is only allowed before a human has committed to a decision on the
// draft (DRAFT/PENDING_REVIEW) — once APPROVED/REJECTED/SENT/CANCELLED, the
// record should reflect exactly what was actually approved/rejected/sent.
export async function updateActivationContent(
  db: PrismaClient,
  activationId: string,
  content: unknown,
): Promise<Activation> {
  const activation = await db.activation.findUniqueOrThrow({ where: { id: activationId } });
  if (activation.status !== "DRAFT" && activation.status !== "PENDING_REVIEW") {
    throw new ActivationNotEditableError(activation.status);
  }

  const schema = getActivationContentSchema(activation.channel);
  const parsed = schema.parse(content); // throws on invalid shape — never persists malformed content
  const { angle, cta } = extractAngleAndCta(activation.channel as ActivationChannelKey, parsed);

  return db.activation.update({
    where: { id: activationId },
    data: { content: parsed as never, angle, cta },
  });
}
