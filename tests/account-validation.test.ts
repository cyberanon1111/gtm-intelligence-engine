import { test } from "node:test";
import assert from "node:assert/strict";
import { accountInputSchema } from "../lib/validation/account";

test("accepts a fully valid account and normalizes derived fields", () => {
  const result = accountInputSchema.safeParse({
    companyName: "  OceanTrans Ship Management  ",
    website: "oceantrans.test",
    country: "Singapore",
    companyType: "Ship Manager",
    fleetSize: "42",
    vesselTypes: "Tanker, Bulk Carrier",
    regions: "Asia Pacific, Middle East",
    status: "RESEARCHING",
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.companyName, "OceanTrans Ship Management");
  assert.equal(result.data.website, "https://oceantrans.test/");
  assert.equal(result.data.fleetSize, 42);
  assert.deepEqual(result.data.vesselTypes, ["Tanker", "Bulk Carrier"]);
  assert.deepEqual(result.data.regions, ["Asia Pacific", "Middle East"]);
});

test("rejects a missing company name", () => {
  const result = accountInputSchema.safeParse({ companyName: "" });
  assert.equal(result.success, false);
});

test("rejects a negative fleet size", () => {
  const result = accountInputSchema.safeParse({ companyName: "Acme", fleetSize: "-5" });
  assert.equal(result.success, false);
});

test("rejects a malformed website", () => {
  const result = accountInputSchema.safeParse({ companyName: "Acme", website: "not a url" });
  assert.equal(result.success, false);
});

test("defaults status to NEW when omitted", () => {
  const result = accountInputSchema.safeParse({ companyName: "Acme" });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.status, "NEW");
});

test("rejects an invalid status value", () => {
  const result = accountInputSchema.safeParse({ companyName: "Acme", status: "MADE_UP" });
  assert.equal(result.success, false);
});

test("treats empty optional fields as absent rather than erroring", () => {
  const result = accountInputSchema.safeParse({
    companyName: "Acme",
    website: "",
    country: "",
    fleetSize: "",
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.website, undefined);
  assert.equal(result.data.fleetSize, undefined);
});
