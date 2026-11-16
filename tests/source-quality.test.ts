import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySourceQuality } from "../config/meridian/sourceQuality";

test("a company website / regulatory filing / vetting database is OFFICIAL_PRIMARY", () => {
  assert.equal(classifySourceQuality("COMPANY_WEBSITE", "https://acme.test"), "OFFICIAL_PRIMARY");
  assert.equal(classifySourceQuality("REGULATORY_FILING", null), "OFFICIAL_PRIMARY");
  assert.equal(classifySourceQuality("SIRE_RIGHTSHIP_DATABASE", null), "OFFICIAL_PRIMARY");
});

test("a recognized maritime trade publication domain is INDUSTRY_PUBLICATION", () => {
  assert.equal(classifySourceQuality("NEWS", "https://www.tradewindsnews.com/article"), "INDUSTRY_PUBLICATION");
  assert.equal(classifySourceQuality("NEWS", "https://splash247.com/article"), "INDUSTRY_PUBLICATION");
});

test("a subdomain of a recognized publication still counts", () => {
  assert.equal(classifySourceQuality("NEWS", "https://feeds.lloydslist.com/story"), "INDUSTRY_PUBLICATION");
});

test("general news/press-release/linkedin from an unrecognized domain is SECONDARY", () => {
  assert.equal(classifySourceQuality("NEWS", "https://random-blog.test/post"), "SECONDARY");
  assert.equal(classifySourceQuality("PRESS_RELEASE", null), "SECONDARY");
  assert.equal(classifySourceQuality("LINKEDIN", "https://linkedin.com/posts/x"), "SECONDARY");
});

test("anything else falls back to UNKNOWN", () => {
  assert.equal(classifySourceQuality("MANUAL", null), "UNKNOWN");
  assert.equal(classifySourceQuality("OTHER", null), "UNKNOWN");
});

test("a malformed URL does not throw — falls through to the sourceType-based classification", () => {
  assert.equal(classifySourceQuality("NEWS", "not a valid url"), "SECONDARY");
});
