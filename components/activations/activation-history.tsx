import Link from "next/link";
import { ActivationStatusBadge, ActivationChannelBadge } from "@/components/activations/activation-badges";

interface ActivationRow {
  id: string;
  channel: string;
  status: string;
  objective: string;
  createdAt: Date;
  approvedAt: Date | null;
  sentAt: Date | null;
  contact: { name: string } | null;
}

// Preserves every generation as its own row (regeneration never overwrites)
// — this is the flat, chronological history the spec asks for on the
// account page.
export function ActivationHistory({ accountId, activations }: { accountId: string; activations: ActivationRow[] }) {
  if (activations.length === 0) {
    return <p className="text-sm text-muted-foreground">No activations generated yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {activations.map((activation) => (
        <Link
          key={activation.id}
          href={`/accounts/${accountId}/activations/${activation.id}`}
          className="flex flex-col gap-1 rounded-md border p-3 text-sm transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{activation.objective}</span>
            <ActivationStatusBadge status={activation.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <ActivationChannelBadge channel={activation.channel} />
            {activation.contact && <span>{activation.contact.name}</span>}
            <span>Created {activation.createdAt.toLocaleDateString()}</span>
            {activation.approvedAt && <span>· Approved {activation.approvedAt.toLocaleDateString()}</span>}
            {activation.sentAt && <span>· Sent {activation.sentAt.toLocaleDateString()}</span>}
          </div>
        </Link>
      ))}
    </div>
  );
}
