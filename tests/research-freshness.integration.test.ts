import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { checkResearchFreshness } from "../lib/research/freshness";

after(async () => {
  await prisma.$disconnect();
});

async function withTestAccount<T>(fn: (accountId: string) => Promise<T>): Promise<T> {
  const account = await prisma.account.create({
    data: { companyName: `Test Freshness Account ${Date.now()}-${Math.random()}` },
  });
  try {
    return await fn(account.id);
  } finally {
    await prisma.account.delete({ where: { id: account.id } });
  }
}

test("an account with no prior research is never fresh", async () => {
  await withTestAccount(async (accountId) => {
    const result = await checkResearchFreshness(prisma, accountId, 24);
    assert.equal(result.fresh, false);
    assert.equal(result.lastRunAt, null);
  });
});

test("a COMPLETED run within the window is fresh", async () => {
  await withTestAccount(async (accountId) => {
    await prisma.researchRun.create({
      data: { accountId, status: "COMPLETED", completedAt: new Date() },
    });
    const result = await checkResearchFreshness(prisma, accountId, 24);
    assert.equal(result.fresh, true);
  });
});

test("a COMPLETED run outside the window is not fresh", async () => {
  await withTestAccount(async (accountId) => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await prisma.researchRun.create({
      data: { accountId, status: "COMPLETED", completedAt: twoDaysAgo },
    });
    const result = await checkResearchFreshness(prisma, accountId, 24);
    assert.equal(result.fresh, false);
  });
});

test("a FAILED run never counts as fresh, even if recent", async () => {
  await withTestAccount(async (accountId) => {
    await prisma.researchRun.create({
      data: { accountId, status: "FAILED", completedAt: new Date() },
    });
    const result = await checkResearchFreshness(prisma, accountId, 24);
    assert.equal(result.fresh, false);
  });
});

test("a SKIPPED run within the window counts as fresh (it reflects real prior research)", async () => {
  await withTestAccount(async (accountId) => {
    await prisma.researchRun.create({
      data: { accountId, status: "COMPLETED", completedAt: new Date(Date.now() - 1000) },
    });
    await prisma.researchRun.create({
      data: { accountId, status: "SKIPPED", completedAt: new Date() },
    });
    const result = await checkResearchFreshness(prisma, accountId, 24);
    assert.equal(result.fresh, true);
  });
});

test("the freshness window is configurable", async () => {
  await withTestAccount(async (accountId) => {
    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);
    await prisma.researchRun.create({
      data: { accountId, status: "COMPLETED", completedAt: tenHoursAgo },
    });
    const withShortWindow = await checkResearchFreshness(prisma, accountId, 5);
    const withLongWindow = await checkResearchFreshness(prisma, accountId, 24);
    assert.equal(withShortWindow.fresh, false);
    assert.equal(withLongWindow.fresh, true);
  });
});
