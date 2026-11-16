import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivationChannelBadge } from "@/components/activations/activation-badges";

export const dynamic = "force-dynamic";

interface ActivationListItem {
  id: string;
  objective: string;
  channel: string;
  createdAt: Date;
  approvedAt: Date | null;
  sentAt: Date | null;
  account: { id: string; companyName: string };
  contact: { name: string } | null;
}

async function fetchByStatus(status: string, orderBy: "createdAt" | "approvedAt" | "sentAt" = "createdAt") {
  return prisma.activation.findMany({
    where: { status: status as never },
    include: { account: { select: { id: true, companyName: true } }, contact: { select: { name: true } } },
    orderBy: { [orderBy]: "desc" },
    take: 25,
  });
}

export default async function ActivationsPage() {
  const [pendingReview, approved, rejected, draft, sent] = await Promise.all([
    fetchByStatus("PENDING_REVIEW"),
    fetchByStatus("APPROVED", "approvedAt"),
    fetchByStatus("REJECTED"),
    fetchByStatus("DRAFT"),
    fetchByStatus("SENT", "sentAt"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activations</h1>
        <p className="text-sm text-muted-foreground">
          Every generated draft, grouped by review status — chronological within each group, never ranked.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActivationGroup title="Pending Review" items={pendingReview} emptyText="Nothing waiting on review." />
        <ActivationGroup title="Recently Approved" items={approved} emptyText="Nothing approved yet." dateLabel="Approved" dateField="approvedAt" />
        <ActivationGroup title="Draft" items={draft} emptyText="No drafts in progress." />
        <ActivationGroup title="Rejected" items={rejected} emptyText="Nothing rejected." />
        <ActivationGroup title="Sent" items={sent} emptyText="Nothing marked sent yet." dateLabel="Sent" dateField="sentAt" />
      </div>
    </div>
  );
}

function ActivationGroup({
  title,
  items,
  emptyText,
  dateLabel = "Created",
  dateField = "createdAt",
}: {
  title: string;
  items: ActivationListItem[];
  emptyText: string;
  dateLabel?: string;
  dateField?: "createdAt" | "approvedAt" | "sentAt";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {title} <span className="font-normal text-muted-foreground">({items.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          items.map((item) => {
            const date = item[dateField];
            return (
              <Link
                key={item.id}
                href={`/accounts/${item.account.id}/activations/${item.id}`}
                className="flex flex-col gap-1 rounded-md border p-2.5 text-sm transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.account.companyName}</span>
                  <ActivationChannelBadge channel={item.channel} />
                </div>
                <p className="truncate text-xs text-muted-foreground">{item.objective}</p>
                <p className="text-xs text-muted-foreground">
                  {item.contact ? `${item.contact.name} · ` : ""}
                  {dateLabel} {date ? date.toLocaleDateString() : "—"}
                </p>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
