// Activation channel metadata — the UI and validation layers read this
// rather than hard-coding channel-specific strings/labels, so a new channel
// is one entry here (plus a Prisma enum value and a content schema in
// lib/ai/schemas/activation.ts), not a scattered set of edits.

export type ActivationChannelKey = "LINKEDIN" | "EMAIL" | "SALES_BRIEF" | "CONTENT_RECOMMENDATION";

export interface ActivationChannelDefinition {
  key: ActivationChannelKey;
  label: string;
  description: string;
  kind: "outbound" | "internal"; // outbound = addressed to a contact; internal = for the GTM team
  requiresContact: boolean;
}

export const ACTIVATION_CHANNELS: ActivationChannelDefinition[] = [
  {
    key: "LINKEDIN",
    label: "LinkedIn Message",
    description: "A short, specific outreach message for a named contact.",
    kind: "outbound",
    requiresContact: true,
  },
  {
    key: "EMAIL",
    label: "Email Draft",
    description: "An email draft for a named contact.",
    kind: "outbound",
    requiresContact: true,
  },
  {
    key: "SALES_BRIEF",
    label: "Sales Research Brief",
    description: "An internal brief for the GTM team — not outbound copy.",
    kind: "internal",
    requiresContact: false,
  },
  {
    key: "CONTENT_RECOMMENDATION",
    label: "Content Recommendation",
    description: "A suggestion for content to create — never auto-published.",
    kind: "internal",
    requiresContact: false,
  },
];

export function getActivationChannelDefinition(key: string): ActivationChannelDefinition | undefined {
  return ACTIVATION_CHANNELS.find((c) => c.key === key);
}
