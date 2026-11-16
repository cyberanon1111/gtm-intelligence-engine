import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { generateActivation } from "../lib/activation/generate";
import { InsufficientActivationContextError } from "../lib/activation/context";
import type { AIClient } from "../lib/ai/client";

after(async () => {
  await prisma.source.deleteMany({ where: { url: null, name: "Test Source" } });
  await prisma.$disconnect();
});

function fakeClient(response: string): AIClient {
  return {
    async complete() {
      return response;
    },
  };
}

const VALID_LINKEDIN = (evidenceUsed: string[]) =>
  JSON.stringify({
    objective: "Introduce MoorSense M4",
    reasoning: "Fleet expansion increases mooring complexity.",
    evidenceUsed,
    confidence: 60,
    content: { angle: "Fleet growth", message: "Hi Jane, ...", cta: "Open to a quick call?" },
  });

async function withTestAccount<T>(fn: (accountId: string) => Promise<T>): Promise<T> {
  const account = await prisma.account.create({
    data: { companyName: `Test Activation Account ${Date.now()}-${Math.random()}` },
  });
  try {
    return await fn(account.id);
  } finally {
    await prisma.account.delete({ where: { id: account.id } });
  }
}

test("generation refuses an account with no score, no Why-Now intelligence, and no evidence", async () => {
  await withTestAccount(async (accountId) => {
    const client = fakeClient(VALID_LINKEDIN([]));
    await assert.rejects(
      () => generateActivation(prisma, { accountId, channel: "LINKEDIN", objective: "Say hi" }, { aiClient: client }),
      InsufficientActivationContextError,
    );
  });
});

test("generation proceeds once the account has at least a computed score", async () => {
  await withTestAccount(async (accountId) => {
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

    const client = fakeClient(VALID_LINKEDIN([]));
    const activation = await generateActivation(
      prisma,
      { accountId, channel: "LINKEDIN", objective: "Introduce MoorSense M4" },
      { aiClient: client },
    );

    assert.equal(activation.status, "DRAFT");
    assert.equal(activation.accountId, accountId);
  });
});

test("a hallucinated evidence id is dropped; real ones are kept", async () => {
  await withTestAccount(async (accountId) => {
    const source = await prisma.source.create({ data: { name: "Test Source", sourceType: "OTHER" } });
    const evidence = await prisma.evidence.create({
      data: { sourceId: source.id, accountId, claim: "Fleet is expanding", claimType: "FACT", confidence: 80 },
    });

    const client = fakeClient(VALID_LINKEDIN([evidence.id, "hallucinated-id-does-not-exist"]));
    const activation = await generateActivation(
      prisma,
      { accountId, channel: "LINKEDIN", objective: "Introduce MoorSense M4" },
      { aiClient: client },
    );

    assert.deepEqual(activation.evidenceIds, [evidence.id]);
  });
});

test("account and contact association are stored correctly", async () => {
  await withTestAccount(async (accountId) => {
    const source = await prisma.source.create({ data: { name: "Test Source", sourceType: "OTHER" } });
    await prisma.evidence.create({
      data: { sourceId: source.id, accountId, claim: "Fleet is expanding", claimType: "FACT", confidence: 80 },
    });
    const contact = await prisma.contact.create({ data: { accountId, name: "Jane Doe" } });

    const client = fakeClient(VALID_LINKEDIN([]));
    const activation = await generateActivation(
      prisma,
      { accountId, contactId: contact.id, channel: "LINKEDIN", objective: "Introduce MoorSense M4" },
      { aiClient: client },
    );

    assert.equal(activation.accountId, accountId);
    assert.equal(activation.contactId, contact.id);
  });
});

test("generation is read-only with respect to score/signal/contact/fact/research records", async () => {
  await withTestAccount(async (accountId) => {
    const source = await prisma.source.create({ data: { name: "Test Source", sourceType: "OTHER" } });
    await prisma.evidence.create({
      data: { sourceId: source.id, accountId, claim: "Fleet is expanding", claimType: "FACT", confidence: 80 },
    });

    const [scoresBefore, signalsBefore, contactsBefore, factsBefore, insightsBefore, accountBefore] =
      await Promise.all([
        prisma.score.findMany({ where: { accountId } }),
        prisma.signal.findMany({ where: { accountId } }),
        prisma.contact.findMany({ where: { accountId } }),
        prisma.fact.findMany({ where: { accountId } }),
        prisma.accountInsight.findMany({ where: { accountId } }),
        prisma.account.findUniqueOrThrow({ where: { id: accountId } }),
      ]);

    const client = fakeClient(VALID_LINKEDIN([]));
    await generateActivation(prisma, { accountId, channel: "LINKEDIN", objective: "Introduce MoorSense M4" }, { aiClient: client });

    const [scoresAfter, signalsAfter, contactsAfter, factsAfter, insightsAfter, accountAfter] = await Promise.all([
      prisma.score.findMany({ where: { accountId } }),
      prisma.signal.findMany({ where: { accountId } }),
      prisma.contact.findMany({ where: { accountId } }),
      prisma.fact.findMany({ where: { accountId } }),
      prisma.accountInsight.findMany({ where: { accountId } }),
      prisma.account.findUniqueOrThrow({ where: { id: accountId } }),
    ]);

    assert.deepEqual(scoresAfter, scoresBefore);
    assert.deepEqual(signalsAfter, signalsBefore);
    assert.deepEqual(contactsAfter, contactsBefore);
    assert.deepEqual(factsAfter, factsBefore);
    assert.deepEqual(insightsAfter, insightsBefore);
    assert.deepEqual(accountAfter, accountBefore);
  });
});

test("a failed generation (malformed AI output) persists no Activation row at all", async () => {
  await withTestAccount(async (accountId) => {
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

    const client = fakeClient("not json");
    await assert.rejects(() =>
      generateActivation(prisma, { accountId, channel: "LINKEDIN", objective: "X" }, { aiClient: client }),
    );

    const activations = await prisma.activation.findMany({ where: { accountId } });
    assert.equal(activations.length, 0);
  });
});
