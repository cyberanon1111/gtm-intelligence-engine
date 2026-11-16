import { test } from "node:test";
import assert from "node:assert/strict";
import { validateContactRows } from "../lib/csv/contactImport";

const accountsByName = { "oceantrans ship management": "acc_1" };
const personasByName = { "marine manager": "persona_1" };

test("a contact row matching a known account and persona is valid", () => {
  const [result] = validateContactRows(
    [
      {
        accountCompanyName: "OceanTrans Ship Management",
        name: "Priya Nair",
        persona: "Marine Manager",
        email: "priya@example.com",
      },
    ],
    accountsByName,
    personasByName,
    {},
  );
  assert.equal(result.status, "valid");
  assert.equal(result.data?.accountId, "acc_1");
  assert.equal(result.data?.personaId, "persona_1");
});

test("a contact row with no matching account is invalid, not dropped", () => {
  const [result] = validateContactRows(
    [{ accountCompanyName: "Unknown Co", name: "Someone" }],
    accountsByName,
    personasByName,
    {},
  );
  assert.equal(result.status, "invalid");
  assert.ok(result.errors.accountCompanyName);
});

test("an unrecognized persona is a warning, not a hard error", () => {
  const [result] = validateContactRows(
    [
      {
        accountCompanyName: "OceanTrans Ship Management",
        name: "Someone",
        persona: "Made Up Persona",
      },
    ],
    accountsByName,
    personasByName,
    {},
  );
  assert.equal(result.status, "valid");
  assert.ok(result.warnings.persona);
  assert.equal(result.data?.personaId, undefined);
});

test("a duplicate email within the file is flagged on the second occurrence", () => {
  const results = validateContactRows(
    [
      { accountCompanyName: "OceanTrans Ship Management", name: "A", email: "dup@example.com" },
      { accountCompanyName: "OceanTrans Ship Management", name: "B", email: "dup@example.com" },
    ],
    accountsByName,
    personasByName,
    {},
  );
  assert.equal(results[0].status, "valid");
  assert.equal(results[1].status, "duplicate");
});

test("an email matching an existing contact on that account is flagged as a duplicate", () => {
  const [result] = validateContactRows(
    [{ accountCompanyName: "OceanTrans Ship Management", name: "A", email: "existing@example.com" }],
    accountsByName,
    personasByName,
    { acc_1: ["existing@example.com"] },
  );
  assert.equal(result.status, "duplicate");
});

test("a malformed email is invalid", () => {
  const [result] = validateContactRows(
    [{ accountCompanyName: "OceanTrans Ship Management", name: "A", email: "not-an-email" }],
    accountsByName,
    personasByName,
    {},
  );
  assert.equal(result.status, "invalid");
  assert.ok(result.errors.email);
});
