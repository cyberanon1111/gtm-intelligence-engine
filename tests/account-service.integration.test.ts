import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { accountInputSchema } from "../lib/validation/account";
import * as accountService from "../lib/accounts/service";

const testCompanyName = `Test Account ${Date.now()}`;

after(async () => {
  await prisma.$disconnect();
});

test("createAccount persists a new account with normalized fields", async () => {
  const input = accountInputSchema.parse({
    companyName: testCompanyName,
    website: "test-account.example",
    fleetSize: "8",
    vesselTypes: "Tanker",
  });
  const account = await accountService.createAccount(prisma, input);
  try {
    assert.equal(account.companyName, testCompanyName);
    assert.equal(account.website, "https://test-account.example/");
    assert.equal(account.fleetSize, 8);
    assert.equal(account.status, "NEW");
    assert.equal(account.archivedAt, null);
  } finally {
    await prisma.account.delete({ where: { id: account.id } });
  }
});

test("updateAccount overwrites fields", async () => {
  const account = await accountService.createAccount(
    prisma,
    accountInputSchema.parse({ companyName: testCompanyName }),
  );
  try {
    const updated = await accountService.updateAccount(
      prisma,
      account.id,
      accountInputSchema.parse({ companyName: testCompanyName, country: "Norway", status: "QUALIFIED" }),
    );
    assert.equal(updated.country, "Norway");
    assert.equal(updated.status, "QUALIFIED");
  } finally {
    await prisma.account.delete({ where: { id: account.id } });
  }
});

test("setAccountArchived sets and clears archivedAt", async () => {
  const account = await accountService.createAccount(
    prisma,
    accountInputSchema.parse({ companyName: testCompanyName }),
  );
  try {
    const archived = await accountService.setAccountArchived(prisma, account.id, true);
    assert.ok(archived.archivedAt);
    const restored = await accountService.setAccountArchived(prisma, account.id, false);
    assert.equal(restored.archivedAt, null);
  } finally {
    await prisma.account.delete({ where: { id: account.id } });
  }
});

test("deleteAccount cascades to its contacts", async () => {
  const account = await accountService.createAccount(
    prisma,
    accountInputSchema.parse({ companyName: testCompanyName }),
  );
  const contact = await prisma.contact.create({
    data: { accountId: account.id, name: "Throwaway Contact" },
  });

  await accountService.deleteAccount(prisma, account.id);

  const found = await prisma.contact.findUnique({ where: { id: contact.id } });
  assert.equal(found, null);
});
