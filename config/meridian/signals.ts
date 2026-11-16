// Signal taxonomy for Meridian Marine Systems (MMS).
//
// This is the swappable piece the architecture doc calls out: a different
// vertical/company would ship a different file here (different categories,
// types, and descriptions) without touching the scoring engine, the Signal
// model, or any UI code. Nothing in lib/ or app/ should hard-code a signal
// type string outside of reading this config.

export type SignalCategoryKey =
  | "GROWTH"
  | "PEOPLE"
  | "COMPLIANCE"
  | "TECHNOLOGY"
  | "ENGAGEMENT";

export interface SignalTypeDefinition {
  type: string;
  label: string;
  description: string;
}

export interface SignalCategoryDefinition {
  category: SignalCategoryKey;
  label: string;
  types: SignalTypeDefinition[];
}

export const SIGNAL_TAXONOMY: SignalCategoryDefinition[] = [
  {
    category: "GROWTH",
    label: "Growth",
    types: [
      {
        type: "FLEET_EXPANSION",
        label: "Fleet Expansion",
        description: "Account is growing the number of vessels it operates or manages.",
      },
      {
        type: "NEW_VESSEL",
        label: "New Vessel",
        description: "A specific new vessel has been added to the fleet.",
      },
      {
        type: "NEWBUILDING",
        label: "Newbuilding",
        description: "Account has placed or delivered a newbuilding order.",
      },
      {
        type: "MARKET_EXPANSION",
        label: "Market Expansion",
        description: "Account is expanding into a new trade lane, region, or vessel segment.",
      },
      {
        type: "ACQUISITION",
        label: "Acquisition",
        description: "Account has acquired or merged with another company or fleet.",
      },
    ],
  },
  {
    category: "PEOPLE",
    label: "People",
    types: [
      {
        type: "LEADERSHIP_CHANGE",
        label: "Leadership Change",
        description: "A senior leadership change at the account.",
      },
      {
        type: "RELEVANT_HIRING",
        label: "Relevant Hiring",
        description: "Account is hiring for a role relevant to MMS's buying committee.",
      },
      {
        type: "MARINE_LEADERSHIP_CHANGE",
        label: "Marine Leadership Change",
        description: "A new Marine Manager, DPA, or similar marine operations leader.",
      },
      {
        type: "COMPLIANCE_LEADERSHIP_CHANGE",
        label: "Compliance Leadership Change",
        description: "A new HSEQ, vetting, or compliance leader.",
      },
    ],
  },
  {
    category: "COMPLIANCE",
    label: "Compliance",
    types: [
      {
        type: "REGULATORY_CHANGE",
        label: "Regulatory Change",
        description: "A regulatory change relevant to the account's fleet or operations.",
      },
      {
        type: "SIRE_ACTIVITY",
        label: "SIRE Activity",
        description: "Activity related to OCIMF SIRE / SIRE 2.0 inspections or programme changes.",
      },
      {
        type: "TMSA_ACTIVITY",
        label: "TMSA Activity",
        description: "Activity related to TMSA3 self-assessment or accreditation.",
      },
      {
        type: "RIGHTSHIP_ACTIVITY",
        label: "RightShip Activity",
        description: "Activity related to RightShip / RISQ assessment.",
      },
      {
        type: "SAFETY_INITIATIVE",
        label: "Safety Initiative",
        description: "Account has announced or launched a safety initiative.",
      },
      {
        type: "COMPLIANCE_ACTIVITY",
        label: "Compliance Activity",
        description:
          "General vetting/compliance activity not covered by a more specific type (SIRE, TMSA, RightShip, regulatory) — the default match for the deterministic signal detector.",
      },
    ],
  },
  {
    category: "TECHNOLOGY",
    label: "Technology",
    types: [
      {
        type: "SOFTWARE_CHANGE",
        label: "Software Change",
        description: "Account is adopting, replacing, or evaluating maritime software.",
      },
      {
        type: "TECHNOLOGY_CHANGE",
        label: "Technology Change",
        description:
          "General technology adoption/change not covered by a more specific type — the default match for the deterministic signal detector.",
      },
      {
        type: "DIGITAL_TRANSFORMATION",
        label: "Digital Transformation",
        description: "Account has announced a broader digital transformation initiative.",
      },
      {
        type: "TECHNOLOGY_HIRING",
        label: "Technology Hiring",
        description: "Account is hiring for technology or digitalization roles.",
      },
    ],
  },
  {
    category: "ENGAGEMENT",
    label: "Engagement",
    types: [
      {
        type: "WEBSITE_ENGAGEMENT",
        label: "Website Engagement",
        description: "Meaningful engagement with MMS's website.",
      },
      {
        type: "CONTENT_ENGAGEMENT",
        label: "Content Engagement",
        description: "Engagement with MMS content (newsletter, whitepaper, blog).",
      },
      {
        type: "EMAIL_ENGAGEMENT",
        label: "Email Engagement",
        description: "Opens, clicks, or replies on outbound email.",
      },
      {
        type: "ASSESSMENT_COMPLETION",
        label: "Assessment Completion",
        description: "Account completed a self-assessment tool (e.g. VDR/compliance scorecard).",
      },
      {
        type: "DEMO_REQUEST",
        label: "Demo Request",
        description: "Account requested a product demo.",
      },
    ],
  },
];

export const SIGNAL_CATEGORY_KEYS: SignalCategoryKey[] = SIGNAL_TAXONOMY.map(
  (c) => c.category,
);

export function isValidSignalCategory(category: string): category is SignalCategoryKey {
  return SIGNAL_CATEGORY_KEYS.includes(category as SignalCategoryKey);
}

export function getSignalTypeDefinition(type: string): SignalTypeDefinition | undefined {
  for (const category of SIGNAL_TAXONOMY) {
    const found = category.types.find((t) => t.type === type);
    if (found) return found;
  }
  return undefined;
}

export function getCategoryForSignalType(type: string): SignalCategoryKey | undefined {
  for (const category of SIGNAL_TAXONOMY) {
    if (category.types.some((t) => t.type === type)) return category.category;
  }
  return undefined;
}

export function isValidSignalType(category: string, type: string): boolean {
  const def = SIGNAL_TAXONOMY.find((c) => c.category === category);
  if (!def) return false;
  return def.types.some((t) => t.type === type);
}
