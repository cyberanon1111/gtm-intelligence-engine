// Buying personas for Meridian Marine Systems (MMS).
// Seeded into the Persona table — swappable per vertical/company.

export interface PersonaDefinition {
  name: string;
  description: string;
  department: string;
  seniorityTier: "LEADERSHIP" | "MANAGEMENT" | "OPERATIONAL";
}

export const PERSONAS: PersonaDefinition[] = [
  {
    name: "Marine Manager",
    description:
      "Owns day-to-day marine operations and mooring/berthing safety across the fleet.",
    department: "Marine Operations",
    seniorityTier: "MANAGEMENT",
  },
  {
    name: "DPA",
    description:
      "Designated Person Ashore — accountable for safety and pollution-prevention compliance (ISM Code).",
    department: "Safety & Compliance",
    seniorityTier: "LEADERSHIP",
  },
  {
    name: "HSEQ Leader",
    description: "Leads Health, Safety, Environment and Quality programmes fleet-wide.",
    department: "HSEQ",
    seniorityTier: "LEADERSHIP",
  },
  {
    name: "Technical Manager",
    description: "Responsible for vessel technical operations, maintenance, and reliability.",
    department: "Technical",
    seniorityTier: "MANAGEMENT",
  },
  {
    name: "Vetting / Compliance Leadership",
    description:
      "Owns SIRE 2.0, TMSA3, and RightShip/RISQ vetting readiness and inspection outcomes.",
    department: "Vetting & Compliance",
    seniorityTier: "LEADERSHIP",
  },
  {
    name: "Maritime Operations Leadership",
    description:
      "Senior leadership with cross-functional responsibility for fleet operations.",
    department: "Operations",
    seniorityTier: "LEADERSHIP",
  },
];
