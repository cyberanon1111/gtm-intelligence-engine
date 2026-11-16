// Problem taxonomy for Meridian Marine Systems (MMS), and the
// mapping from a detected Signal.type to the problem(s) it evidences, and
// from each problem to the product(s) that address it.
//
// This is what the scoring engine's PROBLEM_RELEVANCE dimension reads —
// swapping verticals means swapping this file, never touching engine code.

export interface ProblemDefinition {
  key: string;
  label: string;
  description: string;
}

export const PROBLEMS: ProblemDefinition[] = [
  {
    key: "MOORING_MANAGEMENT_COMPLEXITY",
    label: "Mooring Management Complexity",
    description:
      "Growing or changing fleet makes manual mooring-line monitoring harder to do safely and consistently.",
  },
  {
    key: "COMPLIANCE_READINESS",
    label: "Vetting & Compliance Readiness",
    description:
      "Upcoming or active SIRE 2.0 / TMSA3 / RightShip RISQ activity requires auditable mooring compliance evidence.",
  },
  {
    key: "DIGITAL_TRANSFORMATION_GAP",
    label: "Digital Transformation Gap",
    description:
      "Account is investing in fleet digitalization but may still rely on manual/paper mooring processes.",
  },
  {
    key: "LEADERSHIP_TRANSITION_WINDOW",
    label: "Leadership Transition Window",
    description:
      "A new marine operations, safety, or compliance leader typically reassesses existing vendors and tooling in their first months — a natural window to introduce mooring compliance software before incumbent tools are re-endorsed by default.",
  },
];

// Signal.type -> problem key(s) it's evidence for.
export const SIGNAL_TYPE_TO_PROBLEMS: Record<string, string[]> = {
  FLEET_EXPANSION: ["MOORING_MANAGEMENT_COMPLEXITY"],
  NEW_VESSEL: ["MOORING_MANAGEMENT_COMPLEXITY"],
  NEWBUILDING: ["MOORING_MANAGEMENT_COMPLEXITY"],
  MARKET_EXPANSION: ["MOORING_MANAGEMENT_COMPLEXITY"],
  SIRE_ACTIVITY: ["COMPLIANCE_READINESS"],
  TMSA_ACTIVITY: ["COMPLIANCE_READINESS"],
  RIGHTSHIP_ACTIVITY: ["COMPLIANCE_READINESS"],
  SAFETY_INITIATIVE: ["COMPLIANCE_READINESS"],
  REGULATORY_CHANGE: ["COMPLIANCE_READINESS"],
  COMPLIANCE_ACTIVITY: ["COMPLIANCE_READINESS"],
  DIGITAL_TRANSFORMATION: ["DIGITAL_TRANSFORMATION_GAP"],
  SOFTWARE_CHANGE: ["DIGITAL_TRANSFORMATION_GAP"],
  TECHNOLOGY_CHANGE: ["DIGITAL_TRANSFORMATION_GAP"],
  LEADERSHIP_CHANGE: ["LEADERSHIP_TRANSITION_WINDOW"],
  MARINE_LEADERSHIP_CHANGE: ["LEADERSHIP_TRANSITION_WINDOW"],
  COMPLIANCE_LEADERSHIP_CHANGE: ["LEADERSHIP_TRANSITION_WINDOW"],
};

// Problem key -> relevant Product.name(s).
export const PROBLEM_TO_PRODUCTS: Record<string, string[]> = {
  MOORING_MANAGEMENT_COMPLEXITY: ["MoorSense M4"],
  COMPLIANCE_READINESS: ["MoorSense M4"],
  DIGITAL_TRANSFORMATION_GAP: ["MoorSense M4"],
  LEADERSHIP_TRANSITION_WINDOW: ["MoorSense M4"],
};
