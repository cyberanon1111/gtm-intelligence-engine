"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { accountInputSchema } from "@/lib/validation/account";
import { contactInputSchema } from "@/lib/validation/contact";
import * as accountService from "@/lib/accounts/service";
import * as contactService from "@/lib/contacts/service";
import { computeAndSaveAccountScore } from "@/lib/scoring/persist";

// Scoring is a side effect of these mutations, not their primary purpose —
// if scoring configuration is missing (e.g. seed hasn't run) the mutation
// itself should still succeed rather than fail on a scoring error.
async function recomputeScoreQuietly(accountId: string) {
  try {
    await computeAndSaveAccountScore(prisma, accountId);
  } catch (error) {
    console.error(`Failed to recompute score for account ${accountId}:`, error);
  }
}

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors: Record<string, string> };

function fieldErrorsFrom(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_root";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export async function createAccountAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = accountInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Please fix the errors below.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const account = await accountService.createAccount(prisma, parsed.data);
  await recomputeScoreQuietly(account.id);
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/opportunities");
  return { success: true, data: { id: account.id } };
}

export async function updateAccountAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = accountInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Please fix the errors below.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const account = await accountService.updateAccount(prisma, id, parsed.data);
  await recomputeScoreQuietly(account.id);
  revalidatePath("/accounts");
  revalidatePath(`/accounts/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/opportunities");
  return { success: true, data: { id: account.id } };
}

export async function recalculateScoreAction(accountId: string): Promise<ActionResult> {
  try {
    await computeAndSaveAccountScore(prisma, accountId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not compute a score.";
    return { success: false, error: message, fieldErrors: {} };
  }
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/opportunities");
  return { success: true, data: undefined };
}

export async function setAccountArchivedAction(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  await accountService.setAccountArchived(prisma, id, archived);
  revalidatePath("/accounts");
  revalidatePath(`/accounts/${id}`);
  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}

export async function deleteAccountAction(id: string): Promise<ActionResult> {
  await accountService.deleteAccount(prisma, id);
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}

export async function createContactAction(
  accountId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = contactInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Please fix the errors below.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const contact = await contactService.createContact(prisma, accountId, parsed.data);
  await recomputeScoreQuietly(accountId);
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/opportunities");
  return { success: true, data: { id: contact.id } };
}

export async function updateContactAction(
  id: string,
  accountId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = contactInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Please fix the errors below.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const contact = await contactService.updateContact(prisma, id, parsed.data);
  await recomputeScoreQuietly(accountId);
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/opportunities");
  return { success: true, data: { id: contact.id } };
}

export async function deleteContactAction(id: string, accountId: string): Promise<ActionResult> {
  await contactService.deleteContact(prisma, id);
  await recomputeScoreQuietly(accountId);
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/opportunities");
  return { success: true, data: undefined };
}
