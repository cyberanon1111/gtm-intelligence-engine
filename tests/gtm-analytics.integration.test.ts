import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { computeGtmAnalytics, type AnalyticsBucket } from "../lib/analytics/gtmAnalytics";
import type { ActivationContextSnapshot } from "../lib/activation/snapshot";

after(async () => {
  await prisma.$disconnect();
});

// computeGtmAnalytics aggregates across the whole database by default (it's a
// global dashboard), which would make exact-count assertions here racy — this
// project's test suite runs files concurrently against one real database, and
// other activation test files create/delete their own LINKEDIN/EMAIL rows
// throughout the run. So this test uses computeGtmAnalytics's accountIds
// filter to scope the aggregation to exactly the two fixture accounts it
// creates, making every assertion deterministic regardless of what any other
// concurrently-running test file is doing.
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const ANGLE_A = `Test Angle A ${suffix}`;
const ANGLE_B = `Test Angle B ${suffix}`;
const ANGLE_C = `Test Angle C ${suffix}`;
const SIGNAL_A = `TEST_SIGNAL_A_${suffix}`;
const SIGNAL_B = `TEST_SIGNAL_B_${suffix}`;
const PERSONA_A = `Test Persona A ${suffix}`;
const PERSONA_B = `Test Persona B ${suffix}`;
const PRODUCT = `Test Product ${suffix}`;

function snapshot(opts: { signalType: string; personaName: string; productName: string }): ActivationContextSnapshot {
  return {
    capturedAt: new Date().toISOString(),
    score: {
      id: "score-fixture",
      total: 50,
      icpFit: 10,
      signalStrength: 10,
      problemRelevance: 10,
      buyingPersona: 10,
      engagement: 10,
      scoringVersion: "v1",
      computedAt: new Date().toISOString(),
      componentDetails: {
        signalStrength: { signals: [{ type: opts.signalType }] },
        problemRelevance: { matchedProblems: [{ relevantProducts: [{ name: opts.productName }] }] },
      },
    },
    contact: { id: "contact-fixture", name: "Fixture Contact", title: null, personaName: opts.personaName },
    evidence: [],
    whyNow: null,
    research: null,
    sourceInsightId: null,
  };
}

function findBucket(buckets: AnalyticsBucket[], key: string): AnalyticsBucket | undefined {
  return buckets.find((b) => b.key === key);
}

test("GTM analytics aggregate real activation/outcome rows by channel/angle/signal/persona/product", async () => {
  const accountA = await prisma.account.create({ data: { companyName: `Test Analytics Account A ${suffix}` } });
  const accountB = await prisma.account.create({ data: { companyName: `Test Analytics Account B ${suffix}` } });

  try {
    const activation1 = await prisma.activation.create({
      data: {
        accountId: accountA.id,
        channel: "LINKEDIN",
        status: "SENT",
        objective: "o1",
        angle: ANGLE_A,
        content: { angle: ANGLE_A, message: "m", cta: "c" },
        reasoning: "r",
        model: "test-model",
        promptVersion: "test-v1",
        sentAt: new Date(),
        contextSnapshot: snapshot({ signalType: SIGNAL_A, personaName: PERSONA_A, productName: PRODUCT }) as never,
      },
    });

    await prisma.activation.create({
      data: {
        accountId: accountA.id,
        channel: "EMAIL",
        status: "DRAFT",
        objective: "o2",
        angle: ANGLE_C,
        content: { angle: ANGLE_C, message: "m", cta: "c" },
        reasoning: "r",
        model: "test-model",
        promptVersion: "test-v1",
        contextSnapshot: snapshot({ signalType: SIGNAL_A, personaName: PERSONA_A, productName: PRODUCT }) as never,
      },
    });

    const activation3 = await prisma.activation.create({
      data: {
        accountId: accountB.id,
        channel: "LINKEDIN",
        status: "SENT",
        objective: "o3",
        angle: ANGLE_B,
        content: { angle: ANGLE_B, message: "m", cta: "c" },
        reasoning: "r",
        model: "test-model",
        promptVersion: "test-v1",
        sentAt: new Date(),
        contextSnapshot: snapshot({ signalType: SIGNAL_B, personaName: PERSONA_B, productName: PRODUCT }) as never,
      },
    });

    await prisma.outcomeEvent.create({
      data: { accountId: accountA.id, activationId: activation1.id, type: "REPLIED", occurredAt: new Date(), source: "manual" },
    });
    await prisma.outcomeEvent.create({
      data: { accountId: accountA.id, activationId: activation1.id, type: "POSITIVE_REPLY", occurredAt: new Date(), source: "manual" },
    });
    await prisma.outcomeEvent.create({
      data: { accountId: accountA.id, activationId: activation1.id, type: "MEETING_BOOKED", occurredAt: new Date(), source: "manual" },
    });
    await prisma.outcomeEvent.create({
      data: { accountId: accountB.id, activationId: activation3.id, type: "OPPORTUNITY_CREATED", occurredAt: new Date(), source: "manual" },
    });

    // Scoped to exactly these two fixture accounts — deterministic regardless
    // of what any other concurrently-running test file is doing.
    const after = await computeGtmAnalytics(prisma, { accountIds: [accountA.id, accountB.id] });

    // activation1 (LINKEDIN, SENT) carries REPLIED + POSITIVE_REPLY + MEETING_BOOKED.
    // POSITIVE_REPLY counts toward BOTH "replies" and "positiveReplies" — a
    // positive reply is still a reply — so replies = 2 here, not 1.
    // activation3 (LINKEDIN, SENT) carries OPPORTUNITY_CREATED.
    const linkedin = findBucket(after.byChannel, "LINKEDIN")!;
    assert.equal(linkedin.activations, 2);
    assert.equal(linkedin.sentActivations, 2);
    assert.equal(linkedin.replies, 2);
    assert.equal(linkedin.positiveReplies, 1);
    assert.equal(linkedin.meetings, 1);
    assert.equal(linkedin.opportunities, 1);

    const email = findBucket(after.byChannel, "EMAIL")!;
    assert.equal(email.activations, 1);
    assert.equal(email.sentActivations, 0);
    assert.equal(email.replyRatePct, null, "a rate with zero sent activations must be null, never a fabricated 0%");

    const angleA = findBucket(after.byAngle, ANGLE_A)!;
    assert.equal(angleA.activations, 1);
    assert.equal(angleA.sentActivations, 1);
    assert.equal(angleA.replies, 2);
    assert.equal(angleA.positiveReplies, 1);
    assert.equal(angleA.meetings, 1);
    assert.equal(angleA.replyRatePct, 200, "two reply-type events against one sent activation is a 200% rate, not clamped");

    const angleB = findBucket(after.byAngle, ANGLE_B)!;
    assert.equal(angleB.opportunities, 1);

    const angleC = findBucket(after.byAngle, ANGLE_C)!;
    assert.equal(angleC.sentActivations, 0);
    assert.equal(angleC.replyRatePct, null, "a rate with zero sent activations must be null, never a fabricated 0%");

    const signalA = findBucket(after.bySignalType, SIGNAL_A)!;
    assert.equal(signalA.activations, 2, "both accountA activations share signal type A");
    assert.equal(signalA.sentActivations, 1);
    assert.equal(signalA.replies, 2);

    const signalB = findBucket(after.bySignalType, SIGNAL_B)!;
    assert.equal(signalB.opportunities, 1);

    const personaA = findBucket(after.byPersona, PERSONA_A)!;
    assert.equal(personaA.activations, 2);
    assert.equal(personaA.replies, 2);

    const personaB = findBucket(after.byPersona, PERSONA_B)!;
    assert.equal(personaB.opportunities, 1);

    const product = findBucket(after.byProduct, PRODUCT)!;
    assert.equal(product.activations, 3, "all three fixture activations share the same product");
    assert.equal(product.accounts, 2);
    assert.equal(product.sentActivations, 2);
    assert.equal(product.replies, 2);
    assert.equal(product.opportunities, 1);
  } finally {
    await prisma.account.delete({ where: { id: accountA.id } });
    await prisma.account.delete({ where: { id: accountB.id } });
  }
});

test("analytics buckets are sorted alphabetically by key, never by a metric (no implicit ranking)", async () => {
  const analytics = await computeGtmAnalytics(prisma);
  for (const dimension of [analytics.byChannel, analytics.byAngle, analytics.bySignalType, analytics.byPersona, analytics.byProduct]) {
    const keys = dimension.map((b) => b.key);
    const sorted = [...keys].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(keys, sorted);
  }
});
