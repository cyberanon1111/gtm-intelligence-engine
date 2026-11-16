// Deterministic mapping from an extracted Fact's statement text to the
// Signal type(s) it evidences. This is the "configuration-driven signal
// detection layer" — AI only extracts Facts (lib/ai/agents/factExtractionAgent.ts);
// deciding which Signal type a Fact evidences is plain keyword matching
// against this config, not a model call. Matching is case-insensitive
// substring containment — no fuzzy matching, by design (see Phase 4.5 spec).
//
// A single Fact may match more than one rule (e.g. "appointed a new Head of
// Compliance" is evidence of both LEADERSHIP_CHANGE and COMPLIANCE_ACTIVITY)
// — every match becomes a separate signal candidate.

export interface SignalDetectionRule {
  signalType: string; // must exist in config/meridian/signals.ts SIGNAL_TAXONOMY
  category: string;
  keywords: string[]; // case-insensitive substrings; any match triggers this rule
  defaultStrength: number; // 1-5, used when a matching Fact creates a Signal
}

export const SIGNAL_DETECTION_RULES: SignalDetectionRule[] = [
  {
    signalType: "FLEET_EXPANSION",
    category: "GROWTH",
    keywords: ["fleet expansion", "expanding its fleet", "growing fleet", "added vessels", "added ships"],
    defaultStrength: 3,
  },
  {
    signalType: "NEW_VESSEL",
    category: "GROWTH",
    keywords: ["new vessel", "took delivery of", "delivery of the", "welcomed a new ship"],
    defaultStrength: 3,
  },
  {
    signalType: "NEWBUILDING",
    category: "GROWTH",
    keywords: ["newbuilding", "newbuild order", "ordered a new vessel", "shipyard contract"],
    defaultStrength: 3,
  },
  {
    signalType: "LEADERSHIP_CHANGE",
    category: "PEOPLE",
    keywords: ["appointed", "new ceo", "new chief", "steps down", "named as", "promoted to", "joins as"],
    defaultStrength: 3,
  },
  {
    signalType: "RELEVANT_HIRING",
    category: "PEOPLE",
    keywords: ["is hiring", "job posting", "seeking a", "vacancy for", "now recruiting"],
    defaultStrength: 2,
  },
  {
    signalType: "COMPLIANCE_ACTIVITY",
    category: "COMPLIANCE",
    keywords: ["sire", "tmsa", "rightship", "risq", "vetting", "compliance audit", "inspection"],
    defaultStrength: 3,
  },
  {
    signalType: "SAFETY_INITIATIVE",
    category: "COMPLIANCE",
    keywords: ["safety initiative", "safety programme", "safety program", "safety campaign"],
    defaultStrength: 3,
  },
  {
    signalType: "TECHNOLOGY_CHANGE",
    category: "TECHNOLOGY",
    keywords: [
      "digital transformation",
      "new software",
      "technology platform",
      "implementing a new system",
      "adopts a new",
    ],
    defaultStrength: 3,
  },
  {
    signalType: "MARKET_EXPANSION",
    category: "GROWTH",
    keywords: ["market expansion", "expanding into", "new trade lane", "entering the market"],
    defaultStrength: 3,
  },
  {
    signalType: "ACQUISITION",
    category: "GROWTH",
    keywords: ["acquired", "acquisition of", "merger with", "to acquire", "completes the purchase of"],
    defaultStrength: 4,
  },
];
