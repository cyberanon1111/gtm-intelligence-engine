// Product catalogue for Meridian Marine Systems (MMS).
// Seeded into the Product table, linked to the personas who typically buy it.

export interface ProductDefinition {
  name: string;
  description: string;
  category: string;
  painPointsAddressed: string[];
  relevantSignalTypes: string[];
  personas: string[]; // must match a PersonaDefinition.name in personas.ts
}

export const PRODUCTS: ProductDefinition[] = [
  {
    name: "MoorSense M4",
    description:
      "Mooring management and monitoring platform that digitizes mooring line load data, alerts crews to unsafe mooring conditions, and produces auditable compliance records aligned to OCIMF MEG4.",
    category: "Mooring Management",
    painPointsAddressed: [
      "Manual, error-prone mooring line tension monitoring",
      "Difficulty demonstrating OCIMF MEG4 / SIRE 2.0 mooring compliance during inspections",
      "Mooring-related incidents and near-misses",
      "Lack of auditable evidence for vetting and RightShip RISQ assessments",
    ],
    relevantSignalTypes: [
      "FLEET_EXPANSION",
      "NEWBUILDING",
      "SIRE_ACTIVITY",
      "RIGHTSHIP_ACTIVITY",
      "SAFETY_INITIATIVE",
      "REGULATORY_CHANGE",
    ],
    personas: [
      "Marine Manager",
      "DPA",
      "HSEQ Leader",
      "Technical Manager",
      "Vetting / Compliance Leadership",
    ],
  },
];
