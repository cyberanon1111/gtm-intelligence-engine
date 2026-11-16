// Deterministic scoring configuration for Meridian Marine Systems (MMS).
//
// This data is seeded into ICPRule / ScoringRule. The scoring engine (built in
// a later phase) reads these rows at score time — it never hard-codes point
// values or thresholds. Swapping verticals means swapping this file (and the
// seeded rows it produces), not touching engine code.

export type ICPOperator = "EQUALS" | "NOT_EQUALS" | "IN" | "NOT_IN" | "GTE" | "LTE" | "CONTAINS";

export interface ICPRuleDefinition {
  name: string;
  description: string;
  field: string; // Account field path
  operator: ICPOperator;
  value: unknown;
  points: number;
}

// ICP Fit dimension — max 25 points.
export const ICP_RULES: ICPRuleDefinition[] = [
  {
    name: "Fleet-operating company type",
    description: "Account is a ship manager, ship owner, or fleet operator.",
    field: "companyType",
    operator: "IN",
    value: ["Ship Manager", "Ship Owner", "Fleet Operator"],
    points: 8,
  },
  {
    name: "Fleet size at scale",
    description: "Account operates a fleet large enough for mooring risk/compliance to matter at scale.",
    field: "fleetSize",
    operator: "GTE",
    value: 10,
    points: 6,
  },
  {
    name: "Relevant vessel types",
    description: "Fleet includes vessel types where mooring safety and compliance are highest-stakes.",
    field: "vesselTypes",
    operator: "CONTAINS",
    value: ["Tanker", "Bulk Carrier", "Gas Carrier", "Container"],
    points: 5,
  },
  {
    name: "Core operating regions",
    description: "Account operates in regions with high SIRE/RightShip vetting intensity.",
    field: "regions",
    operator: "CONTAINS",
    value: ["Middle East", "Asia Pacific", "Europe"],
    points: 3,
  },
  {
    name: "Key maritime domicile",
    description: "Account is headquartered in a major maritime hub.",
    field: "country",
    operator: "IN",
    value: ["Singapore", "Greece", "Japan", "Norway", "United Kingdom", "India", "UAE"],
    points: 3,
  },
];

export interface ScoringRuleDefinition {
  dimension: "SIGNAL_STRENGTH" | "PROBLEM_RELEVANCE" | "BUYING_PERSONA" | "ENGAGEMENT";
  name: string;
  description: string;
  maxPoints: number;
  config: Record<string, unknown>;
}

export const SCORING_RULES: ScoringRuleDefinition[] = [
  {
    dimension: "SIGNAL_STRENGTH",
    name: "Non-engagement signal strength",
    description:
      "Points per active (non-expired) signal, by category. ENGAGEMENT-category signals are scored separately under the Engagement dimension.",
    maxPoints: 25,
    config: {
      pointsPerCategory: {
        COMPLIANCE: 10,
        GROWTH: 8,
        TECHNOLOGY: 4,
        PEOPLE: 3,
      },
      maxSignalsCounted: 5,
      defaultDecayHalfLifeDays: 60,
    },
  },
  {
    dimension: "PROBLEM_RELEVANCE",
    name: "Signal-to-problem match",
    description:
      "Points per distinct problem evidenced by the account's signals (see config/meridian/problems.ts for the signal-type -> problem -> product mapping).",
    maxPoints: 20,
    config: {
      pointsPerMatchedProblem: 5,
      maxMatches: 4,
    },
  },
  {
    dimension: "BUYING_PERSONA",
    name: "Buying committee presence",
    description:
      "Points based on the highest seniority-tier relevant persona identified among the account's known contacts. A contact only counts if a real Persona is assigned — a generic job title is never inferred as a buying persona.",
    maxPoints: 15,
    config: {
      pointsBySeniorityTier: {
        LEADERSHIP: 15,
        MANAGEMENT: 10,
        OPERATIONAL: 5,
      },
      relevantPersonaNames: [
        "Marine Manager",
        "DPA",
        "HSEQ Leader",
        "Technical Manager",
        "Vetting / Compliance Leadership",
      ],
    },
  },
  {
    dimension: "ENGAGEMENT",
    name: "Direct engagement",
    description:
      "The single highest-value engagement signal (e.g. a demo request) OR the single highest-value Activity Outcome (e.g. a meeting booked), whichever is greater — not additive. Returns 0 when neither exists; engagement is never invented.",
    maxPoints: 15,
    config: {
      pointsPerSignalType: {
        DEMO_REQUEST: 15,
        ASSESSMENT_COMPLETION: 12,
        CONTENT_ENGAGEMENT: 6,
        EMAIL_ENGAGEMENT: 4,
        WEBSITE_ENGAGEMENT: 3,
      },
      pointsPerOutcomeType: {
        MEETING_BOOKED: 15,
        OPPORTUNITY_CREATED: 15,
        CLOSED_WON: 15,
        REPLIED: 6,
        CLOSED_LOST: 0,
        NO_RESPONSE: 0,
        UNSUBSCRIBED: 0,
        OTHER: 2,
      },
      aggregation: "max",
      defaultDecayHalfLifeDays: 45,
    },
  },
];
