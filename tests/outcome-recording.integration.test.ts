import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { recordOutcomeEvent, OutcomeValidationError } from "../lib/outcomes/record";

after(async () => {
  await prisma.$disconnect();
});

async function withFixture<T>(
  fn: (ctx: { accountId: string; otherAccountId: string; contactId: string; activationId: string }) => Promise<T>,
): Promise<T> {
  const account = await prisma.account.create({ data: { companyName: `Test Outcome Account ${Date.now()}-${Math.random()}` } });
  const otherAccount = await prisma.account.create({ data: { companyName: `Test Outcome Other Account ${Date.now()}-${Math.random()}` } });
  const contact = await prisma.contact.create({ data: { accountId: account.id, name: "Jane Doe" } });
  const activation = await prisma.activation.create({
    data: {
      accountId: account.id,
      channel: "LINKEDIN",
      objective: "Introduce MoorSense M4",
      content: { angle: "a", message: "m", cta: "c" },
      reasoning: "test fixture",
      model: "test-model",
      promptVersion: "test-v1",
    },
  });

  try {
    return await fn({ accountId: account.id, otherAccountId: otherAccount.id, contactId: contact.id, activationId: activation.id });
  } finally {
    await prisma.account.delete({ where: { id: account.id } });
    await prisma.account.delete({ where: { id: otherAccount.id } });
  }
}

test("recording a valid outcome event creates a row with the given type/date/metadata", async () => {
  await withFixture(async ({ accountId, activationId }) => {
    const occurredAt = new Date("2026-01-15T10:00:00Z");
    const outcome = await recordOutcomeEvent(prisma, {
      accountId,
      activationId,
      type: "REPLIED",
      occurredAt,
      metadata: { notes: "Replied asking for more info" },
    });

    assert.equal(outcome.type, "REPLIED");
    assert.equal(outcome.occurredAt.toISOString(), occurredAt.toISOString());
    assert.equal(outcome.source, "manual");
    assert.deepEqual(outcome.metadata, { notes: "Replied asking for more info" });
  });
});

test("multiple outcome events can be recorded against the same activation", async () => {
  await withFixture(async ({ accountId, activationId }) => {
    await recordOutcomeEvent(prisma, { accountId, activationId, type: "DELIVERED", occurredAt: new Date("2026-01-10T09:00:00Z") });
    await recordOutcomeEvent(prisma, { accountId, activationId, type: "OPENED", occurredAt: new Date("2026-01-10T10:00:00Z") });
    await recordOutcomeEvent(prisma, { accountId, activationId, type: "REPLIED", occurredAt: new Date("2026-01-11T09:00:00Z") });

    const events = await prisma.outcomeEvent.findMany({ where: { activationId } });
    assert.equal(events.length, 3);
    assert.deepEqual(
      events.map((e) => e.type).sort(),
      ["DELIVERED", "OPENED", "REPLIED"],
    );
  });
});

test("an outcome event correctly associates account, contact, and activation", async () => {
  await withFixture(async ({ accountId, contactId, activationId }) => {
    const outcome = await recordOutcomeEvent(prisma, {
      accountId,
      contactId,
      activationId,
      type: "MEETING_BOOKED",
      occurredAt: new Date(),
    });

    assert.equal(outcome.accountId, accountId);
    assert.equal(outcome.contactId, contactId);
    assert.equal(outcome.activationId, activationId);
  });
});

test("an outcome event can be recorded at the account level with no activation", async () => {
  await withFixture(async ({ accountId }) => {
    const outcome = await recordOutcomeEvent(prisma, {
      accountId,
      type: "OPPORTUNITY_WON",
      occurredAt: new Date(),
    });

    assert.equal(outcome.activationId, null);
    assert.equal(outcome.accountId, accountId);
  });
});

test("recording an outcome with a contact that belongs to a different account is rejected", async () => {
  await withFixture(async ({ otherAccountId, contactId }) => {
    await assert.rejects(
      () => recordOutcomeEvent(prisma, { accountId: otherAccountId, contactId, type: "REPLIED", occurredAt: new Date() }),
      OutcomeValidationError,
    );
  });
});

test("recording an outcome with an activation that belongs to a different account is rejected", async () => {
  await withFixture(async ({ otherAccountId, activationId }) => {
    await assert.rejects(
      () => recordOutcomeEvent(prisma, { accountId: otherAccountId, activationId, type: "REPLIED", occurredAt: new Date() }),
      OutcomeValidationError,
    );
  });
});

test("recording an outcome for a nonexistent account is rejected", async () => {
  await assert.rejects(
    () => recordOutcomeEvent(prisma, { accountId: "does-not-exist", type: "REPLIED", occurredAt: new Date() }),
    OutcomeValidationError,
  );
});

test("an invalid outcome type is rejected by validation, never silently coerced", async () => {
  await withFixture(async ({ accountId }) => {
    await assert.rejects(() =>
      recordOutcomeEvent(prisma, { accountId, type: "NOT_A_REAL_TYPE", occurredAt: new Date() }),
    );
  });
});

test("metadata with an unexpected shape is rejected rather than silently stored", async () => {
  await withFixture(async ({ accountId }) => {
    await assert.rejects(() =>
      recordOutcomeEvent(prisma, {
        accountId,
        type: "REPLIED",
        occurredAt: new Date(),
        metadata: { unexpectedField: "should not be allowed" },
      }),
    );
  });
});

test("recording an outcome never mutates Score/Signal/Fact/Account/Activation rows", async () => {
  await withFixture(async ({ accountId, activationId }) => {
    await prisma.score.create({
      data: {
        accountId,
        icpFit: 10,
        signalStrength: 0,
        problemRelevance: 0,
        buyingPersona: 0,
        engagement: 0,
        total: 10,
        scoringVersion: "v1",
        componentDetails: {},
      },
    });

    const [scoresBefore, activationBefore, accountBefore] = await Promise.all([
      prisma.score.findMany({ where: { accountId } }),
      prisma.activation.findUniqueOrThrow({ where: { id: activationId } }),
      prisma.account.findUniqueOrThrow({ where: { id: accountId } }),
    ]);

    await recordOutcomeEvent(prisma, { accountId, activationId, type: "REPLIED", occurredAt: new Date() });

    const [scoresAfter, activationAfter, accountAfter] = await Promise.all([
      prisma.score.findMany({ where: { accountId } }),
      prisma.activation.findUniqueOrThrow({ where: { id: activationId } }),
      prisma.account.findUniqueOrThrow({ where: { id: accountId } }),
    ]);

    assert.deepEqual(scoresAfter, scoresBefore);
    assert.deepEqual(activationAfter, activationBefore);
    assert.deepEqual(accountAfter, accountBefore);
  });
});
