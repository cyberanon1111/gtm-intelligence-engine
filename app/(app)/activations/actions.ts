"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { generateActivation } from "@/lib/activation/generate";
import { regenerateActivation } from "@/lib/activation/regenerate";
import {
  submitForReview,
  approveActivation,
  rejectActivation,
  markActivationSent,
  cancelActivation,
  updateActivationContent,
} from "@/lib/activation/transitions";
import type { ActivationChannelKey } from "@/config/meridian/activationChannels";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

// The user's own email, used only for approval attribution — never sent
// anywhere external, matching the "identify the user for authorship" use.
const APPROVER_EMAIL = "tanishkaverma39@gmail.com";

function revalidateActivation(accountId: string) {
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/activations");
}

export async function generateActivationAction(input: {
  accountId: string;
  contactId?: string | null;
  channel: ActivationChannelKey;
  objective: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const activation = await generateActivation(prisma, input);
    revalidateActivation(input.accountId);
    return { success: true, data: { id: activation.id } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Generation failed." };
  }
}

export async function regenerateActivationAction(activationId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const activation = await regenerateActivation(prisma, activationId);
    revalidateActivation(activation.accountId);
    return { success: true, data: { id: activation.id } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Regeneration failed." };
  }
}

export async function updateActivationContentAction(
  activationId: string,
  content: unknown,
): Promise<ActionResult> {
  try {
    const activation = await updateActivationContent(prisma, activationId, content);
    revalidateActivation(activation.accountId);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not save the edit." };
  }
}

export async function submitActivationForReviewAction(activationId: string): Promise<ActionResult> {
  try {
    const activation = await submitForReview(prisma, activationId);
    revalidateActivation(activation.accountId);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not submit for review." };
  }
}

export async function approveActivationAction(activationId: string): Promise<ActionResult> {
  try {
    const activation = await approveActivation(prisma, activationId, APPROVER_EMAIL);
    revalidateActivation(activation.accountId);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not approve." };
  }
}

export async function rejectActivationAction(activationId: string): Promise<ActionResult> {
  try {
    const activation = await rejectActivation(prisma, activationId);
    revalidateActivation(activation.accountId);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not reject." };
  }
}

// No external send happens here — see lib/activation/transitions.ts.
export async function markActivationSentAction(activationId: string): Promise<ActionResult> {
  try {
    const activation = await markActivationSent(prisma, activationId);
    revalidateActivation(activation.accountId);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not mark as sent." };
  }
}

export async function cancelActivationAction(activationId: string): Promise<ActionResult> {
  try {
    const activation = await cancelActivation(prisma, activationId);
    revalidateActivation(activation.accountId);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not cancel." };
  }
}
