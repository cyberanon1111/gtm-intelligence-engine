"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { recordOutcomeEvent } from "@/lib/outcomes/record";
import type { OutcomeEventTypeKey } from "@/config/meridian/outcomeTypes";

export type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

export async function recordOutcomeEventAction(input: {
  accountId: string;
  contactId?: string | null;
  activationId?: string | null;
  type: OutcomeEventTypeKey;
  occurredAt: string; // ISO string from the client
  notes?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const outcome = await recordOutcomeEvent(prisma, {
      accountId: input.accountId,
      contactId: input.contactId ?? null,
      activationId: input.activationId ?? null,
      type: input.type,
      occurredAt: new Date(input.occurredAt),
      metadata: input.notes ? { notes: input.notes } : null,
    });

    revalidatePath(`/accounts/${input.accountId}`);
    if (input.activationId) {
      revalidatePath(`/accounts/${input.accountId}/activations/${input.activationId}`);
    }
    revalidatePath("/outcomes");
    revalidatePath("/analytics");

    return { success: true, data: { id: outcome.id } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to record outcome." };
  }
}
