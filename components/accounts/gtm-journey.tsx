import { Badge } from "@/components/ui/badge";
import type { JourneyEntry } from "@/lib/journey/accountJourney";

const TYPE_LABEL: Record<JourneyEntry["type"], string> = {
  SIGNAL_DETECTED: "Signal",
  SCORE_COMPUTED: "Score",
  RESEARCH_RUN: "Research",
  ACTIVATION_GENERATED: "Activation",
  ACTIVATION_APPROVED: "Approval",
  ACTIVATION_SENT: "Sent",
  OUTCOME: "Outcome",
};

// A merged, factual, reverse-chronological feed of everything that actually
// happened for this account. Every line is a direct restatement of a stored
// field (see lib/journey/accountJourney.ts) — nothing here is inferred or
// implies one event caused another.
export function GtmJourney({ entries }: { entries: JourneyEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No journey events recorded yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry, i) => (
        <div key={i} className="flex items-start gap-3 border-b pb-2 text-sm last:border-0 last:pb-0">
          <Badge variant="outline" className="mt-0.5 shrink-0">
            {TYPE_LABEL[entry.type]}
          </Badge>
          <div>
            <p>{entry.summary}</p>
            <p className="text-xs text-muted-foreground">
              {entry.occurredAt.toLocaleString()}
              {entry.context ? ` · ${entry.context}` : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
