import { Badge } from "@/components/ui/badge";
import type { WhyNowResult } from "@/lib/ai/schemas/whyNow";

interface ContactRow {
  id: string;
  name: string;
  title: string | null;
  persona: { name: string } | null;
}

// Grouping contacts by persona is entirely deterministic (straight from the
// Contact/Persona tables). The AI only ever adds a rationale/stakeholder
// label for a persona group that already exists here — it can't invent a
// buying-committee member, and never claims "decision maker" status.
export function BuyingCommittee({
  contacts,
  whyNow,
}: {
  contacts: ContactRow[];
  whyNow: WhyNowResult | null;
}) {
  const withPersona = contacts.filter((c) => c.persona);
  if (withPersona.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No contacts have an assigned persona yet — add one from the Contacts section below.
      </p>
    );
  }

  const groups = new Map<string, ContactRow[]>();
  for (const contact of withPersona) {
    const name = contact.persona!.name;
    const group = groups.get(name) ?? [];
    group.push(contact);
    groups.set(name, group);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([personaName, groupContacts]) => {
        const aiNote = whyNow?.relevantPersonas.find((p) => p.personaName === personaName);
        return (
          <div key={personaName}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{personaName}</span>
              {aiNote && <Badge variant="outline">{aiNote.stakeholderLabel}</Badge>}
            </div>
            <ul className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground">
              {groupContacts.map((c) => (
                <li key={c.id}>
                  {c.name}
                  {c.title ? ` — ${c.title}` : ""}
                </li>
              ))}
            </ul>
            {aiNote && <p className="mt-1 text-xs text-muted-foreground">{aiNote.rationale}</p>}
          </div>
        );
      })}
    </div>
  );
}
