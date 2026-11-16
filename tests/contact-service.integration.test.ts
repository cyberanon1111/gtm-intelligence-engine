import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { accountInputSchema } from "../lib/validation/account";
import { contactInputSchema } from "../lib/validation/contact";
import * as accountService from "../lib/accounts/service";
import * as contactService from "../lib/contacts/service";

after(async () => {
  await prisma.$disconnect();
});

async function withTestAccount<T>(fn: (accountId: string) => Promise<T>): Promise<T> {
  const account = await accountService.createAccount(
    prisma,
    accountInputSchema.parse({ companyName: `Test Account ${Date.now()}-${Math.random()}` }),
  );
  try {
    return await fn(account.id);
  } finally {
    await prisma.account.delete({ where: { id: account.id } });
  }
}

test("createContact persists a contact linked to its account", async () => {
  await withTestAccount(async (accountId) => {
    const input = contactInputSchema.parse({
      name: "Test Contact",
      email: "Test.Contact@Example.com",
      influenceScore: "75",
    });
    const contact = await contactService.createContact(prisma, accountId, input);
    assert.equal(contact.accountId, accountId);
    assert.equal(contact.email, "test.contact@example.com");
    assert.equal(contact.influenceScore, 75);
  });
});

test("updateContact overwrites fields", async () => {
  await withTestAccount(async (accountId) => {
    const contact = await contactService.createContact(
      prisma,
      accountId,
      contactInputSchema.parse({ name: "Test Contact" }),
    );
    const updated = await contactService.updateContact(
      prisma,
      contact.id,
      contactInputSchema.parse({ name: "Test Contact", title: "DPA", seniority: "DIRECTOR" }),
    );
    assert.equal(updated.title, "DPA");
    assert.equal(updated.seniority, "DIRECTOR");
  });
});

test("deleteContact removes the contact without affecting the account", async () => {
  await withTestAccount(async (accountId) => {
    const contact = await contactService.createContact(
      prisma,
      accountId,
      contactInputSchema.parse({ name: "Test Contact" }),
    );
    await contactService.deleteContact(prisma, contact.id);
    const found = await prisma.contact.findUnique({ where: { id: contact.id } });
    assert.equal(found, null);
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    assert.ok(account);
  });
});
