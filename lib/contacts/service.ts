import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { ContactInput } from "@/lib/validation/contact";

export async function createContact(db: PrismaClient, accountId: string, input: ContactInput) {
  return db.contact.create({ data: { ...input, accountId } });
}

export async function updateContact(db: PrismaClient, id: string, input: ContactInput) {
  return db.contact.update({ where: { id }, data: input });
}

export async function deleteContact(db: PrismaClient, id: string) {
  return db.contact.delete({ where: { id } });
}
