import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAccountRows } from "../lib/csv/accountImport";
import { guessColumnMapping, applyColumnMapping } from "../lib/csv/mapping";
import { ACCOUNT_CSV_FIELDS } from "../lib/csv/fields";

test("valid rows parse into structured account data", () => {
  const [result] = validateAccountRows(
    [{ companyName: "Acme Shipping", fleetSize: "12", vesselTypes: "Tanker, Bulk Carrier" }],
    new Set(),
  );
  assert.equal(result.status, "valid");
  assert.equal(result.data?.fleetSize, 12);
  assert.deepEqual(result.data?.vesselTypes, ["Tanker", "Bulk Carrier"]);
});

test("a row missing the required company name is invalid, not silently dropped", () => {
  const [result] = validateAccountRows([{ companyName: "", fleetSize: "12" }], new Set());
  assert.equal(result.status, "invalid");
  assert.ok(result.errors.companyName);
});

test("a malformed fleet size is invalid with a field-level error", () => {
  const [result] = validateAccountRows([{ companyName: "Acme", fleetSize: "not-a-number" }], new Set());
  assert.equal(result.status, "invalid");
  assert.ok(result.errors.fleetSize);
});

test("a second row with the same company name is flagged as an in-file duplicate", () => {
  const results = validateAccountRows(
    [{ companyName: "Acme Shipping" }, { companyName: "acme shipping" }],
    new Set(),
  );
  assert.equal(results[0].status, "valid");
  assert.equal(results[1].status, "duplicate");
});

test("a row matching an existing DB account name is flagged as a duplicate", () => {
  const [result] = validateAccountRows(
    [{ companyName: "OceanTrans Ship Management" }],
    new Set(["oceantrans ship management"]),
  );
  assert.equal(result.status, "duplicate");
});

test("column mapping guesses common header aliases", () => {
  const mapping = guessColumnMapping(
    ["Company Name", "Website", "Fleet Size", "Some Unrelated Column"],
    ACCOUNT_CSV_FIELDS,
  );
  assert.equal(mapping["Company Name"], "companyName");
  assert.equal(mapping["Website"], "website");
  assert.equal(mapping["Fleet Size"], "fleetSize");
  assert.equal(mapping["Some Unrelated Column"], null);
});

test("applying a mapping drops unmapped columns and renames mapped ones", () => {
  const mapped = applyColumnMapping(
    [{ "Company Name": "Acme", Junk: "ignore me" }],
    { "Company Name": "companyName", Junk: null },
  );
  assert.deepEqual(mapped, [{ companyName: "Acme" }]);
});
