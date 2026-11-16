"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { accountInputSchema } from "@/lib/validation/account";
import { contactInputSchema } from "@/lib/validation/contact";
import { computeAndSaveAccountScore } from "@/lib/scoring/persist";

async function recomputeScoreQuietly(accountId: string) {
  try {
    await computeAndSaveAccountScore(prisma, accountId);
  } catch (error) {
    console.error(`Failed to recompute score for account ${accountId}:`, error);
  }
}

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function getAccountImportContextAction(): Promise<{
  existingCompanyNames: string[];
}> {
  const accounts = await prisma.account.findMany({ select: { companyName: true } });
  return { existingCompanyNames: accounts.map((a) => a.companyName.trim().toLowerCase()) };
}

export async function getContactImportContextAction(): Promise<{
  accountsByName: Record<string, string>;
  personasByName: Record<string, string>;
  existingEmailsByAccount: Record<string, string[]>;
}> {
  const [accounts, personas, contacts] = await Promise.all([
    prisma.account.findMany({ select: { id: true, companyName: true } }),
    prisma.persona.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.contact.findMany({ select: { accountId: true, email: true } }),
  ]);

  const accountsByName: Record<string, string> = {};
  for (const a of accounts) accountsByName[a.companyName.trim().toLowerCase()] = a.id;

  const personasByName: Record<string, string> = {};
  for (const p of personas) personasByName[p.name.trim().toLowerCase()] = p.id;

  const existingEmailsByAccount: Record<string, string[]> = {};
  for (const c of contacts) {
    if (!c.email) continue;
    (existingEmailsByAccount[c.accountId] ??= []).push(c.email.toLowerCase());
  }

  return { accountsByName, personasByName, existingEmailsByAccount };
}

export async function importAccountsRowsAction(
  rows: unknown[],
): Promise<ActionResult<{ imported: number; rejected: number }>> {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: "No rows to import." };
  }

  const validRows = [];
  for (const row of rows) {
    const parsed = accountInputSchema.safeParse(row);
    if (parsed.success) validRows.push(parsed.data);
  }

  if (validRows.length === 0) {
    return { success: false, error: "None of the submitted rows passed validation." };
  }

  const created = await prisma.account.createManyAndReturn({
    data: validRows,
    select: { id: true },
  });
  await Promise.all(created.map((a) => recomputeScoreQuietly(a.id)));

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/opportunities");

  return {
    success: true,
    data: { imported: validRows.length, rejected: rows.length - validRows.length },
  };
}

const contactImportRowSchema = contactInputSchema.extend({
  accountId: z.string().min(1, "Missing accountId"),
});

export async function importContactsRowsAction(
  rows: unknown[],
): Promise<ActionResult<{ imported: number; rejected: number }>> {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: "No rows to import." };
  }

  const candidateRows = [];
  for (const row of rows) {
    const parsed = contactImportRowSchema.safeParse(row);
    if (parsed.success) candidateRows.push(parsed.data);
  }

  if (candidateRows.length === 0) {
    return { success: false, error: "None of the submitted rows passed validation." };
  }

  const accountIds = [...new Set(candidateRows.map((r) => r.accountId))];
  const existingAccounts = await prisma.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true },
  });
  const existingAccountIds = new Set(existingAccounts.map((a) => a.id));
  const validRows = candidateRows.filter((r) => existingAccountIds.has(r.accountId));

  if (validRows.length === 0) {
    return { success: false, error: "None of the submitted rows reference an existing account." };
  }

  await prisma.contact.createMany({ data: validRows });

  const affectedAccountIds = new Set(validRows.map((r) => r.accountId));
  await Promise.all([...affectedAccountIds].map((id) => recomputeScoreQuietly(id)));
  for (const id of affectedAccountIds) revalidatePath(`/accounts/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/opportunities");

  return {
    success: true,
    data: { imported: validRows.length, rejected: rows.length - validRows.length },
  };
}
