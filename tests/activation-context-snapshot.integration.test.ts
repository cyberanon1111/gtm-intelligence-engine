import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { generateActivation } from "../lib/activation/generate";
import { regenerateActivation } from "../lib/activation/regenerate";
import { recordOutcomeEvent } from "../lib/outcomes/record";
import { parseActivationContextSnapshot } from "../lib/activation/snapshot";
import type { AIClient } from "../lib/ai/client";

after(async () => {
  await prisma.$disconnect();
});

function fakeClient(response: string): AIClient {
  return { async complete() { return response; } };
}

const VALID_LINKEDIN = JSON.stringify({
  objective: "Introduce MoorSense M4",
  reasoning: "Fleet expansion increases mooring complexity.",
  evidenceUsed: [],
  confidence: 60,
  content: { angle: "Fleet growth", message: "Hi Jane, ...", cta: "Open to a quick call?" },
});

const VALID_CONTENT_REC = JSON.stringify({
  objective: "Suggest content",
  reasoning: "A case study would resonate with this persona.",
  evidenceUsed: [],
  confidence: 50,
  content: {
    targetProblem: "Mooring Management Complexity",
    targetPersona: "Marine Manager",
    contentAngle: "How growing fleets manage mooring risk",
    suggestedFormat: "Case study",
    supportingEvidenceSummary: "Fleet is expanding per on-file signal.",
    suggestedCta: "Download the case study",
  },
});

const VALID_SALES_BRIEF = JSON.stringify({
  objective: "Prep for outreach",
  reasoning: "Summarizing known facts for the team.",
  evidenceUsed: [],
  confidence: 55,
  content: {
    whyNow: "Fleet expansion increases mooring complexity.",
    relevantSignals: ["Fleet expansion"],
    relevantProblem: "Mooring Management Complexity",
    potentialStakeholder: "Jane Doe (Marine Manager)",
    relevantProduct: "MoorSense M4",
    suggestedOpening: "I saw you're expanding the fleet — how are you handling mooring monitoring today?",
  },
});

async function withScoredAccount<T>(
  scoreOverrides: Partial<{ total: number; componentDetails: object }>,
  fn: (accountId: string) => Promise<T>,
): Promise<T> {
  const account = await prisma.account.create({
    data: { companyName: `Test Snapshot Account ${Date.now()}-${Math.random()}` },
  });
  try {
    await prisma.score.create({
      data: {
        accountId: account.id,
        icpFit: 10,
        signalStrength: 5,
        problemRelevance: 0,
        buyingPersona: 0,
        engagement: 0,
        total: scoreOverrides.total ?? 15,
        scoringVersion: "v1",
        componentDetails: scoreOverrides.componentDetails ?? {},
      },
    });
    return await fn(account.id);
  } finally {
    await prisma.account.delete({ where: { id: account.id } });
  }
}

test("the context snapshot captures the score/matched-problems/contact known at generation time", async () => {
  const componentDetails = {
    problemRelevance: {
      matchedProblems: [
        {
          problemKey: "MOORING_MANAGEMENT_COMPLEXITY",
          label: "Mooring Complexity",
          description: "d",
          evidenceSignalIds: [],
          relevantProducts: [{ id: "p1", name: "MoorSense M4" }],
        },
      ],
      countedMatches: 1,
    },
    signalStrength: { signals: [{ signalId: "s1", title: "Fleet growth", category: "GROWTH", type: "FLEET_EXPANSION", basePoints: 5, decayFactor: 1, ageDays: 0, effectivePoints: 5, expired: false, counted: true }] },
  };

  await withScoredAccount({ total: 42, componentDetails }, async (accountId) => {
    const contact = await prisma.contact.create({ data: { accountId, name: "Jane Doe", title: "Marine Manager" } });
    const activation = await generateActivation(
      prisma,
      { accountId, contactId: contact.id, channel: "LINKEDIN", objective: "Introduce MoorSense M4" },
      { aiClient: fakeClient(VALID_LINKEDIN) },
    );

    const snapshot = parseActivationContextSnapshot(activation.contextSnapshot);
    assert.ok(snapshot, "snapshot should parse successfully");
    assert.equal(snapshot?.score?.total, 42);
    assert.equal(snapshot?.contact?.name, "Jane Doe");
    const details = snapshot?.score?.componentDetails as typeof componentDetails;
    assert.equal(details.problemRelevance.matchedProblems[0].relevantProducts[0].name, "MoorSense M4");
    assert.equal(details.signalStrength.signals[0].type, "FLEET_EXPANSION");
  });
});

test("the snapshot is frozen — a later score change is never reflected back into an earlier activation's snapshot", async () => {
  await withScoredAccount({ total: 20 }, async (accountId) => {
    const activation = await generateActivation(
      prisma,
      { accountId, channel: "LINKEDIN", objective: "Introduce MoorSense M4" },
      { aiClient: fakeClient(VALID_LINKEDIN) },
    );

    const originalSnapshot = parseActivationContextSnapshot(activation.contextSnapshot);
    assert.equal(originalSnapshot?.score?.total, 20);

    // The account gets rescored significantly higher after the activation was generated.
    await prisma.score.create({
      data: {
        accountId,
        icpFit: 25,
        signalStrength: 25,
        problemRelevance: 20,
        buyingPersona: 15,
        engagement: 15,
        total: 100,
        scoringVersion: "v1",
        componentDetails: {},
      },
    });

    const refetched = await prisma.activation.findUniqueOrThrow({ where: { id: activation.id } });
    const refetchedSnapshot = parseActivationContextSnapshot(refetched.contextSnapshot);
    assert.equal(refetchedSnapshot?.score?.total, 20, "the frozen snapshot must not have been reconstructed from current records");
  });
});

test("angle/cta are correctly extracted per channel: LINKEDIN uses angle/cta, CONTENT_RECOMMENDATION uses contentAngle/suggestedCta, SALES_BRIEF has neither", async () => {
  await withScoredAccount({}, async (accountId) => {
    const linkedin = await generateActivation(
      prisma,
      { accountId, channel: "LINKEDIN", objective: "x" },
      { aiClient: fakeClient(VALID_LINKEDIN) },
    );
    assert.equal(linkedin.angle, "Fleet growth");
    assert.equal(linkedin.cta, "Open to a quick call?");

    const contentRec = await generateActivation(
      prisma,
      { accountId, channel: "CONTENT_RECOMMENDATION", objective: "x" },
      { aiClient: fakeClient(VALID_CONTENT_REC) },
    );
    assert.equal(contentRec.angle, "How growing fleets manage mooring risk");
    assert.equal(contentRec.cta, "Download the case study");

    const salesBrief = await generateActivation(
      prisma,
      { accountId, channel: "SALES_BRIEF", objective: "x" },
      { aiClient: fakeClient(VALID_SALES_BRIEF) },
    );
    assert.equal(salesBrief.angle, null);
    assert.equal(salesBrief.cta, null);
  });
});

test("outcome events recorded against an activation survive that activation's regeneration, attributed to the original version only", async () => {
  await withScoredAccount({}, async (accountId) => {
    const original = await generateActivation(
      prisma,
      { accountId, channel: "LINKEDIN", objective: "x" },
      { aiClient: fakeClient(VALID_LINKEDIN) },
    );

    const outcome = await recordOutcomeEvent(prisma, {
      accountId,
      activationId: original.id,
      type: "REPLIED",
      occurredAt: new Date(),
    });

    const regenerated = await regenerateActivation(prisma, original.id, { aiClient: fakeClient(VALID_LINKEDIN) });

    const refetchedOutcome = await prisma.outcomeEvent.findUniqueOrThrow({ where: { id: outcome.id } });
    assert.equal(refetchedOutcome.activationId, original.id, "the outcome must stay attributed to the original activation");
    assert.notEqual(refetchedOutcome.activationId, regenerated.id);

    const regeneratedOutcomes = await prisma.outcomeEvent.findMany({ where: { activationId: regenerated.id } });
    assert.equal(regeneratedOutcomes.length, 0, "the regenerated version starts with no outcomes of its own");
  });
});
