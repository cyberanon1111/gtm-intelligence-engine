import Link from "next/link";
import { OutcomeBadge } from "@/components/outcomes/outcome-badge";

interface OutcomeRow {
  id: string;
  type: string;
  occurredAt: Date;
  metadata: unknown;
  contact: { name: string } | null;
  activation: { id: string; channel: string; objective: string } | null;
}

function readNotes(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && "notes" in metadata) {
    const notes = (metadata as { notes?: unknown }).notes;
    return typeof notes === "string" && notes.length > 0 ? notes : null;
  }
  return null;
}

// Flat, append-only list — every recorded event stays visible forever, never
// collapsed into a single "current status" (Phase 6 section 1/10).
export function OutcomeHistory({ accountId, outcomes }: { accountId: string; outcomes: OutcomeRow[] }) {
  if (outcomes.length === 0) {
    return <p className="text-sm text-muted-foreground">No outcomes recorded yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {outcomes.map((outcome) => {
        const notes = readNotes(outcome.metadata);
        return (
          <div key={outcome.id} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <OutcomeBadge type={outcome.type} />
              <span className="text-xs text-muted-foreground">{outcome.occurredAt.toLocaleString()}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {outcome.contact && <span>{outcome.contact.name} · </span>}
              {outcome.activation ? (
                <Link
                  href={`/accounts/${accountId}/activations/${outcome.activation.id}`}
                  className="hover:underline"
                >
                  {outcome.activation.objective}
                </Link>
              ) : (
                <span>Account-level (no specific activation)</span>
              )}
            </div>
            {notes && <p className="text-xs italic text-muted-foreground">{notes}</p>}
          </div>
        );
      })}
    </div>
  );
}
