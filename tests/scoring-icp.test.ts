import { test } from "node:test";
import assert from "node:assert/strict";
import { computeIcpFit, evaluateIcpRule, type IcpAccountFields } from "../lib/scoring/icpFit";
import type { ICPRule } from "../lib/generated/prisma/client";

function rule(overrides: Partial<ICPRule>): ICPRule {
  return {
    id: "rule_1",
    name: "Test Rule",
    description: "A test rule",
    field: "companyType",
    operator: "EQUALS",
    value: "Ship Manager",
    points: 10,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ICPRule;
}

function account(overrides: Partial<IcpAccountFields>): IcpAccountFields {
  return {
    companyType: "Ship Manager",
    fleetSize: 20,
    vesselTypes: ["Tanker"],
    regions: ["Europe"],
    country: "Norway",
    ...overrides,
  };
}

test("EQUALS matches an exact field value", () => {
  const r = evaluateIcpRule(rule({ operator: "EQUALS", field: "companyType", value: "Ship Manager" }), account({}));
  assert.equal(r.matched, true);
  assert.equal(r.points, 10);
});

test("IN matches when field value is in the configured list", () => {
  const r = evaluateIcpRule(
    rule({ operator: "IN", field: "companyType", value: ["Ship Manager", "Ship Owner"], points: 8 }),
    account({ companyType: "Ship Owner" }),
  );
  assert.equal(r.matched, true);
  assert.equal(r.points, 8);
});

test("GTE matches when a numeric field meets the threshold", () => {
  const r = evaluateIcpRule(rule({ operator: "GTE", field: "fleetSize", value: 10, points: 6 }), account({ fleetSize: 10 }));
  assert.equal(r.matched, true);
});

test("GTE does not match below the threshold", () => {
  const r = evaluateIcpRule(rule({ operator: "GTE", field: "fleetSize", value: 10 }), account({ fleetSize: 9 }));
  assert.equal(r.matched, false);
  assert.equal(r.points, 0);
});

test("CONTAINS matches an array field with any overlap", () => {
  const r = evaluateIcpRule(
    rule({ operator: "CONTAINS", field: "vesselTypes", value: ["Tanker", "Bulk Carrier"] }),
    account({ vesselTypes: ["Container", "Tanker"] }),
  );
  assert.equal(r.matched, true);
});

test("a field with no data never matches, regardless of operator", () => {
  const r = evaluateIcpRule(rule({ operator: "GTE", field: "fleetSize", value: 5 }), account({ fleetSize: null }));
  assert.equal(r.matched, false);
  assert.match(r.explanation, /No data/);
});

test("an empty array field never matches CONTAINS", () => {
  const r = evaluateIcpRule(
    rule({ operator: "CONTAINS", field: "vesselTypes", value: ["Tanker"] }),
    account({ vesselTypes: [] }),
  );
  assert.equal(r.matched, false);
});

test("computeIcpFit sums matched rule points and clamps at the dimension max (25)", () => {
  const rules = [
    rule({ id: "1", field: "companyType", operator: "EQUALS", value: "Ship Manager", points: 20 }),
    rule({ id: "2", field: "fleetSize", operator: "GTE", value: 10, points: 20 }),
  ];
  const { points, detail } = computeIcpFit(account({}), rules);
  assert.equal(points, 25); // 20 + 20 = 40, clamped to 25
  assert.equal(detail.rules.length, 2);
});

test("computeIcpFit ignores inactive rules", () => {
  const rules = [rule({ active: false, points: 25 })];
  const { points, detail } = computeIcpFit(account({}), rules);
  assert.equal(points, 0);
  assert.equal(detail.rules.length, 0);
});

test("computeIcpFit with zero rules yields the minimum score (0)", () => {
  const { points } = computeIcpFit(account({}), []);
  assert.equal(points, 0);
});

test("computeIcpFit is deterministic for the same inputs", () => {
  const rules = [rule({})];
  const a = account({});
  const first = computeIcpFit(a, rules);
  const second = computeIcpFit(a, rules);
  assert.deepEqual(first, second);
});
