// Deterministic source-quality classification. Independent of Evidence's
// FACT/INFERENCE/RECOMMENDATION claim-type semantics — this is purely "how
// authoritative is the place this came from", never model-judged.

export const OFFICIAL_SOURCE_TYPES = ["COMPANY_WEBSITE", "REGULATORY_FILING", "SIRE_RIGHTSHIP_DATABASE"];

// Recognized maritime trade publication domains. A source from one of these
// is treated as a credible industry publication rather than an unknown
// outlet — a small, explicit allowlist, not a heuristic guess.
export const KNOWN_INDUSTRY_PUBLICATION_DOMAINS = [
  "lloydslist.com",
  "tradewindsnews.com",
  "splash247.com",
  "marinelink.com",
  "seatrade-maritime.com",
  "hellenicshippingnews.com",
  "maritime-executive.com",
  "rivieramm.com",
];

export type SourceQualityValue = "OFFICIAL_PRIMARY" | "INDUSTRY_PUBLICATION" | "SECONDARY" | "UNKNOWN";

export function classifySourceQuality(sourceType: string, url: string | null): SourceQualityValue {
  if (OFFICIAL_SOURCE_TYPES.includes(sourceType)) return "OFFICIAL_PRIMARY";

  if (url) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      if (
        KNOWN_INDUSTRY_PUBLICATION_DOMAINS.some(
          (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
        )
      ) {
        return "INDUSTRY_PUBLICATION";
      }
    } catch {
      // malformed URL — fall through to the generic classification below
    }
  }

  if (sourceType === "NEWS" || sourceType === "PRESS_RELEASE" || sourceType === "LINKEDIN") {
    return "SECONDARY";
  }

  return "UNKNOWN";
}
