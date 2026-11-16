import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { AccountInput } from "@/lib/validation/account";

export async function createAccount(db: PrismaClient, input: AccountInput) {
  return db.account.create({ data: input });
}

export async function updateAccount(db: PrismaClient, id: string, input: AccountInput) {
  return db.account.update({ where: { id }, data: input });
}

export async function setAccountArchived(db: PrismaClient, id: string, archived: boolean) {
  return db.account.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });
}

export async function deleteAccount(db: PrismaClient, id: string) {
  // Cascades to Contact, Signal, Evidence, AccountInsight, Score, Activity
  // (and Activity -> Outcome) per the schema's onDelete: Cascade relations.
  return db.account.delete({ where: { id } });
}
