import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  assertTransition,
  InvalidActivationTransitionError,
  type ActivationStatusValue,
} from "../lib/activation/statusTransitions";

const ALL_STATUSES: ActivationStatusValue[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "SENT",
  "CANCELLED",
];

test("the documented happy path is fully allowed: DRAFT -> PENDING_REVIEW -> APPROVED -> SENT", () => {
  assert.equal(canTransition("DRAFT", "PENDING_REVIEW"), true);
  assert.equal(canTransition("PENDING_REVIEW", "APPROVED"), true);
  assert.equal(canTransition("APPROVED", "SENT"), true);
});

test("SENT is reachable ONLY from APPROVED — never directly from DRAFT or PENDING_REVIEW", () => {
  assert.equal(canTransition("DRAFT", "SENT"), false);
  assert.equal(canTransition("PENDING_REVIEW", "SENT"), false);
  assert.equal(canTransition("APPROVED", "SENT"), true);
});

test("REJECTED is terminal — no outgoing transitions, ever, including to SENT", () => {
  for (const to of ALL_STATUSES) {
    assert.equal(canTransition("REJECTED", to), false, `REJECTED -> ${to} should be disallowed`);
  }
});

test("SENT and CANCELLED are also terminal", () => {
  for (const to of ALL_STATUSES) {
    assert.equal(canTransition("SENT", to), false, `SENT -> ${to} should be disallowed`);
    assert.equal(canTransition("CANCELLED", to), false, `CANCELLED -> ${to} should be disallowed`);
  }
});

test("PENDING_REVIEW can go to APPROVED, REJECTED, or CANCELLED — nothing else", () => {
  assert.equal(canTransition("PENDING_REVIEW", "APPROVED"), true);
  assert.equal(canTransition("PENDING_REVIEW", "REJECTED"), true);
  assert.equal(canTransition("PENDING_REVIEW", "CANCELLED"), true);
  assert.equal(canTransition("PENDING_REVIEW", "DRAFT"), false);
  assert.equal(canTransition("PENDING_REVIEW", "SENT"), false);
});

test("a status can never transition to itself", () => {
  for (const status of ALL_STATUSES) {
    assert.equal(canTransition(status, status), false, `${status} -> ${status} should be disallowed`);
  }
});

test("assertTransition throws InvalidActivationTransitionError for a disallowed transition", () => {
  assert.throws(() => assertTransition("DRAFT", "SENT"), InvalidActivationTransitionError);
  assert.throws(() => assertTransition("REJECTED", "APPROVED"), InvalidActivationTransitionError);
});

test("assertTransition does not throw for an allowed transition", () => {
  assert.doesNotThrow(() => assertTransition("DRAFT", "PENDING_REVIEW"));
});
