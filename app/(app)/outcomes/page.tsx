import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OutcomeFilters } from "@/components/outcomes/outcome-filters";
import { OutcomeBadge } from "@/components/outcomes/outcome-badge";
import { ActivationChannelBadge } from "@/components/activations/activation-badges";
import { listOutcomeEvents } from "@/lib/outcomes/queries";
import type { OutcomeEventTypeKey } from "@/config/meridian/outcomeTypes";
import type { ActivationChannelKey } from "@/config/meridian/activationChannels";

export const dynamic = "force-dynamic";

export default async function OutcomesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const get = (key: string) => {
    const v = raw[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const [accounts, personaRows, productRows] = await Promise.all([
    prisma.account.findMany({ select: { id: true, companyName: true }, orderBy: { companyName: "asc" } }),
    prisma.persona.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  const outcomes = await listOutcomeEvents(prisma, {
    type: get("type") as OutcomeEventTypeKey | undefined,
    channel: get("channel") as ActivationChannelKey | undefined,
    accountId: get("accountId"),
    personaName: get("persona"),
    productName: get("product"),
    dateFrom: get("from") ? new Date(`${get("from")}T00:00:00`) : undefined,
    dateTo: get("to") ? new Date(`${get("to")}T23:59:59`) : undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outcomes</h1>
        <p className="text-sm text-muted-foreground">
          Every manually recorded outcome event, filterable — counts below reflect exactly what&apos;s in the
          database, nothing estimated.
        </p>
      </div>

      <OutcomeFilters
        accounts={accounts}
        personas={personaRows.map((p) => p.name)}
        products={productRows.map((p) => p.name)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {outcomes.length} matching event{outcomes.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {outcomes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outcome events match these filters.</p>
          ) : (
            outcomes.map((o) => (
              <div key={o.id} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/accounts/${o.account.id}`} className="font-medium hover:underline">
                    {o.account.companyName}
                  </Link>
                  <div className="flex items-center gap-2">
                    {o.activation && <ActivationChannelBadge channel={o.activation.channel} />}
                    <OutcomeBadge type={o.type} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {o.contact && <span>{o.contact.name} · </span>}
                  {o.activation ? (
                    <Link href={`/accounts/${o.account.id}/activations/${o.activation.id}`} className="hover:underline">
                      {o.activation.objective}
                    </Link>
                  ) : (
                    <span>Account-level</span>
                  )}
                  {" · "}
                  {o.occurredAt.toLocaleString()}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
