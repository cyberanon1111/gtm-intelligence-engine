import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBuyingPersona, type ContactWithPersona } from "../lib/scoring/buyingPersona";
import type { BuyingPersonaConfig } from "../lib/scoring/configSchemas";

const CONFIG: BuyingPersonaConfig = {
  pointsBySeniorityTier: { LEADERSHIP: 15, MANAGEMENT: 10, OPERATIONAL: 5 },
  relevantPersonaNames: ["Marine Manager", "DPA"],
};

function contact(overrides: Partial<ContactWithPersona>): ContactWithPersona {
  return {
    id: "c1",
    accountId: "acc_1",
    name: "Test Contact",
    title: null,
    department: null,
    linkedinUrl: null,
    email: null,
    seniority: null,
    influenceScore: null,
    personaId: null,
    persona: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ContactWithPersona;
}

function persona(name: string, seniorityTier: string | null) {
  return {
    id: `persona_${name}`,
    name,
    description: null,
    department: null,
    seniorityTier,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ContactWithPersona["persona"];
}

test("no contacts yields the minimum score (0)", () => {
  const { points, detail } = computeBuyingPersona([], CONFIG);
  assert.equal(points, 0);
  assert.deepEqual(detail.matchedContacts, []);
});

test("a contact with no persona assigned does not count, even with a senior-sounding title", () => {
  const c = contact({ title: "Chief Executive Officer", persona: null });
  const { points } = computeBuyingPersona([c], CONFIG);
  assert.equal(points, 0);
});

test("a contact with a relevant, leadership-tier persona scores the leadership points", () => {
  const c = contact({ persona: persona("DPA", "LEADERSHIP") });
  const { points, detail } = computeBuyingPersona([c], CONFIG);
  assert.equal(points, 15);
  assert.equal(detail.winningContactId, c.id);
});

test("a contact whose persona is not in the relevant list does not count", () => {
  const c = contact({ persona: persona("Maritime Operations Leadership", "LEADERSHIP") });
  const { points } = computeBuyingPersona([c], CONFIG);
  assert.equal(points, 0);
});

test("multiple relevant contacts: the score is the single highest tier, not additive", () => {
  const contacts = [
    contact({ id: "a", persona: persona("Marine Manager", "MANAGEMENT") }),
    contact({ id: "b", persona: persona("DPA", "LEADERSHIP") }),
  ];
  const { points, detail } = computeBuyingPersona(contacts, CONFIG);
  assert.equal(points, 15); // not 10 + 15
  assert.equal(detail.winningContactId, "b");
});

test("an unrecognized seniority tier scores zero for that contact", () => {
  const c = contact({ persona: persona("DPA", "UNKNOWN_TIER") });
  const { points } = computeBuyingPersona([c], CONFIG);
  assert.equal(points, 0);
});

test("is deterministic for the same inputs", () => {
  const contacts = [contact({ persona: persona("DPA", "LEADERSHIP") })];
  const first = computeBuyingPersona(contacts, CONFIG);
  const second = computeBuyingPersona(contacts, CONFIG);
  assert.deepEqual(first, second);
});

test("the score is clamped at the dimension max (15) even if config is misconfigured above it", () => {
  const inflatedConfig: BuyingPersonaConfig = {
    pointsBySeniorityTier: { LEADERSHIP: 999 },
    relevantPersonaNames: ["DPA"],
  };
  const c = contact({ persona: persona("DPA", "LEADERSHIP") });
  const { points } = computeBuyingPersona([c], inflatedConfig);
  assert.equal(points, 15);
});
