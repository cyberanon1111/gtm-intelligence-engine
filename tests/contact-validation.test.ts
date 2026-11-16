import { test } from "node:test";
import assert from "node:assert/strict";
import { contactInputSchema } from "../lib/validation/contact";

test("accepts a fully valid contact", () => {
  const result = contactInputSchema.safeParse({
    name: "Priya Nair",
    title: "Marine Manager",
    department: "Marine Operations",
    linkedinUrl: "linkedin.com/in/priyanair",
    email: "Priya.Nair@Example.com",
    seniority: "MANAGER",
    influenceScore: "60",
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.email, "priya.nair@example.com");
  assert.equal(result.data.influenceScore, 60);
  assert.equal(result.data.linkedinUrl, "https://linkedin.com/in/priyanair");
});

test("accepts a contact with only a name", () => {
  const result = contactInputSchema.safeParse({ name: "Lars Eriksen" });
  assert.equal(result.success, true);
});

test("rejects a missing name", () => {
  const result = contactInputSchema.safeParse({ name: "" });
  assert.equal(result.success, false);
});

test("rejects a malformed email", () => {
  const result = contactInputSchema.safeParse({ name: "Test", email: "not-an-email" });
  assert.equal(result.success, false);
});

test("rejects an influence score out of range", () => {
  const result = contactInputSchema.safeParse({ name: "Test", influenceScore: "150" });
  assert.equal(result.success, false);
});
