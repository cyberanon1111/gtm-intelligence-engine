// Outcome event type metadata — the UI and validation layers read this rather
// than hard-coding type-specific strings/labels, so a new lifecycle event is
// one new Prisma enum value plus one new entry here, not a scattered set of
// edits (same pattern as config/meridian/activationChannels.ts).

export type OutcomeEventTypeKey =
  | "DELIVERED"
  | "OPENED"
  | "CLICKED"
  | "REPLIED"
  | "POSITIVE_REPLY"
  | "NEGATIVE_REPLY"
  | "MEETING_BOOKED"
  | "MEETING_HELD"
  | "OPPORTUNITY_CREATED"
  | "OPPORTUNITY_WON"
  | "OPPORTUNITY_LOST"
  | "NO_RESPONSE"
  | "UNSUBSCRIBED";

export interface OutcomeEventTypeDefinition {
  key: OutcomeEventTypeKey;
  label: string;
  description: string;
  // Purely descriptive grouping for UI layout (e.g. section headers in the
  // record-outcome form) — never used to imply one type is "better" than
  // another, and never used as a ranking/scoring input.
  group: "delivery" | "reply" | "meeting" | "opportunity" | "other";
}

export const OUTCOME_EVENT_TYPES: OutcomeEventTypeDefinition[] = [
  { key: "DELIVERED", label: "Delivered", description: "The message was successfully delivered.", group: "delivery" },
  { key: "OPENED", label: "Opened", description: "The recipient opened the message.", group: "delivery" },
  { key: "CLICKED", label: "Clicked", description: "The recipient clicked a link in the message.", group: "delivery" },
  { key: "REPLIED", label: "Replied", description: "The recipient replied (sentiment not specified).", group: "reply" },
  { key: "POSITIVE_REPLY", label: "Positive reply", description: "The recipient replied positively.", group: "reply" },
  { key: "NEGATIVE_REPLY", label: "Negative reply", description: "The recipient replied negatively / declined.", group: "reply" },
  { key: "MEETING_BOOKED", label: "Meeting booked", description: "A meeting was scheduled as a result.", group: "meeting" },
  { key: "MEETING_HELD", label: "Meeting held", description: "A previously booked meeting actually took place.", group: "meeting" },
  { key: "OPPORTUNITY_CREATED", label: "Opportunity created", description: "A sales opportunity was opened.", group: "opportunity" },
  { key: "OPPORTUNITY_WON", label: "Opportunity won", description: "The opportunity closed as a win.", group: "opportunity" },
  { key: "OPPORTUNITY_LOST", label: "Opportunity lost", description: "The opportunity closed as a loss.", group: "opportunity" },
  { key: "NO_RESPONSE", label: "No response", description: "No response was received (recorded explicitly, not inferred from silence).", group: "other" },
  { key: "UNSUBSCRIBED", label: "Unsubscribed", description: "The recipient opted out of further contact.", group: "other" },
];

export function getOutcomeEventTypeDefinition(key: string): OutcomeEventTypeDefinition | undefined {
  return OUTCOME_EVENT_TYPES.find((t) => t.key === key);
}
