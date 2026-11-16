import type { Contact, Persona } from "@/lib/generated/prisma/client";
import { DIMENSION_MAX } from "@/lib/scoring/constants";
import type { BuyingPersonaConfig } from "@/lib/scoring/configSchemas";
import type { BuyingPersonaDetail, MatchedContact } from "@/lib/scoring/types";

export type ContactWithPersona = Contact & { persona: Persona | null };

// A contact only counts if a real Persona row is assigned — never inferred
// from a free-text `title`. Score is the single highest-tier match (not
// additive): a second VP doesn't double the buying-committee signal.
export function computeBuyingPersona(
  contacts: ContactWithPersona[],
  config: BuyingPersonaConfig,
): { points: number; detail: BuyingPersonaDetail } {
  const matches: MatchedContact[] = contacts
    .filter((c) => c.persona && config.relevantPersonaNames.includes(c.persona.name))
    .map((c) => {
      const persona = c.persona!;
      const seniorityTier = persona.seniorityTier ?? "OPERATIONAL";
      const points = config.pointsBySeniorityTier[seniorityTier] ?? 0;
      return { contactId: c.id, name: c.name, personaName: persona.name, seniorityTier, points };
    })
    .sort((a, b) => b.points - a.points);

  const winning = matches[0];
  const points = Math.min(winning?.points ?? 0, DIMENSION_MAX.BUYING_PERSONA);

  return {
    points,
    detail: { matchedContacts: matches, winningContactId: winning?.contactId },
  };
}
