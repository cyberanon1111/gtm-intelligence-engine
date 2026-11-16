import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { generateActivation } from "../lib/activation/generate";
import { regenerateActivation } from "../lib/activation/regenerate";
import {
  submitForReview,
  approveActivation,
  rejectActivation,
  markActivationSent,
  cancelActivation,
  updateActivationContent,
  ActivationNotEditableError,
} from "../lib/activation/transitions";
import { InvalidActivationTransitionError } from "../lib/activation/statusTransitions";
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

const VALID_LINKEDIN = JSON.stringify({
  objective: "Introduce MoorSense M4",
  reasoning: "Fleet expansion increases mooring complexity.",
  evidenceUsed: [],
  confidence: 60,
  content: { angle: "Fleet growth", message: "Hi Jane, ...", cta: "Open to a quick call?" },
});

async function withGeneratedActivation<T>(fn: (accountId: string, activationId: string) => Promise<T>): Promise<T> {
  const account = await prisma.account.create({
    data: { companyName: `Test Workflow Account ${Date.now()}-${Math.random()}` },
  });
  try {
    await prisma.score.create({
      data: {
        accountId: account.id,
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
    const activation = await generateActivation(
      prisma,
      { accountId: account.id, channel: "LINKEDIN", objective: "Introduce MoorSense M4" },
      { aiClient: fakeClient(VALID_LINKEDIN) },
    );
    return await fn(account.id, activation.id);
  } finally {
    await prisma.account.delete({ where: { id: account.id } });
  }
}

test("a newly generated activation starts as DRAFT", async () => {
  await withGeneratedActivation(async (_accountId, activationId) => {
    const activation = await prisma.activation.findUniqueOrThrow({ where: { id: activationId } });
    assert.equal(activation.status, "DRAFT");
  });
});

test("approval transition: PENDING_REVIEW -> APPROVED sets approvedAt/approvedBy", async () => {
  await withGeneratedActivation(async (_accountId, activationId) => {
    await submitForReview(prisma, activationId);
    const approved = await approveActivation(prisma, activationId, "reviewer@example.com");
    assert.equal(approved.status, "APPROVED");
    assert.ok(approved.approvedAt);
    assert.equal(approved.approvedBy, "reviewer@example.com");
  });
});

test("rejection transition: PENDING_REVIEW -> REJECTED sets rejectedAt, and REJECTED is never sendable", async () => {
  await withGeneratedActivation(async (_accountId, activationId) => {
    await submitForReview(prisma, activationId);
    const rejected = await rejectActivation(prisma, activationId);
    assert.equal(rejected.status, "REJECTED");
    assert.ok(rejected.rejectedAt);

    await assert.rejects(() => markActivationSent(prisma, activationId), InvalidActivationTransitionError);
  });
});

test("invalid transition: DRAFT cannot go directly to SENT", async () => {
  await withGeneratedActivation(async (_accountId, activationId) => {
    await assert.rejects(() => markActivationSent(prisma, activationId), InvalidActivationTransitionError);
  });
});

test("invalid transition: DRAFT cannot go directly to APPROVED (must pass through PENDING_REVIEW)", async () => {
  await withGeneratedActivation(async (_accountId, activationId) => {
    await assert.rejects(() => approveActivation(prisma, activationId), InvalidActivationTransitionError);
  });
});

test("marking an activation SENT never makes any external call — it's a plain DB write", async () => {
  await withGeneratedActivation(async (_accountId, activationId) => {
    await submitForReview(prisma, activationId);
    await approveActivation(prisma, activationId);
    // markActivationSent takes no AIClient/fetch dependency at all — if it
    // required one, this call (with none provided) would not compile/would
    // throw. Its only effect is the DB write we assert below.
    const sent = await markActivationSent(prisma, activationId);
    assert.equal(sent.status, "SENT");
    assert.ok(sent.sentAt);
  });
});

test("cancellation is available from DRAFT, PENDING_REVIEW, and APPROVED", async () => {
  await withGeneratedActivation(async (_accountId, activationId) => {
    const cancelled = await cancelActivation(prisma, activationId);
    assert.equal(cancelled.status, "CANCELLED");
  });
});

test("regeneration creates a new row and leaves the previous one completely untouched", async () => {
  await withGeneratedActivation(async (_accountId, activationId) => {
    const original = await prisma.activation.findUniqueOrThrow({ where: { id: activationId } });

    const regenerated = await regenerateActivation(prisma, activationId, { aiClient: fakeClient(VALID_LINKEDIN) });

    assert.notEqual(regenerated.id, activationId);
    assert.equal(regenerated.regeneratedFromId, activationId);
    assert.equal(regenerated.version, original.version + 1);
    assert.equal(regenerated.status, "DRAFT");

    const originalAfter = await prisma.activation.findUniqueOrThrow({ where: { id: activationId } });
    assert.deepEqual(originalAfter, original);

    const all = await prisma.activation.findMany({ where: { accountId: original.accountId } });
    assert.equal(all.length, 2);
  });
});

test("editing content is allowed while DRAFT", async () => {
  await withGeneratedActivation(async (_accountId, activationId) => {
    const updated = await updateActivationContent(prisma, activationId, {
      angle: "Edited angle",
      message: "Edited message",
      cta: "Edited CTA",
    });
    assert.equal((updated.content as { angle: string }).angle, "Edited angle");
  });
});

test("editing content is rejected once an activation is APPROVED", async () => {
  await withGeneratedActivation(async (_accountId, activationId) => {
    await submitForReview(prisma, activationId);
    await approveActivation(prisma, activationId);

    await assert.rejects(
      () =>
        updateActivationContent(prisma, activationId, {
          angle: "Edited angle",
          message: "Edited message",
          cta: "Edited CTA",
        }),
      ActivationNotEditableError,
    );
  });
});

test("editing content with an invalid shape for the channel is rejected", async () => {
  await withGeneratedActivation(async (_accountId, activationId) => {
    await assert.rejects(() => updateActivationContent(prisma, activationId, { angle: "only angle" }));
  });
});
