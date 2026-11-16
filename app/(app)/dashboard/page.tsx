import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ACCOUNT_STATUS_BADGE_VARIANT, ACCOUNT_STATUS_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [totalAccounts, totalContacts, accountsWithSignals, recentAccounts] = await Promise.all([
    prisma.account.count({ where: { archivedAt: null } }),
    prisma.contact.count(),
    prisma.account.count({ where: { archivedAt: null, signals: { some: {} } } }),
    prisma.account.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, companyName: true, companyType: true, status: true, createdAt: true },
    }),
  ]);

  const stats = [
    { label: "Total Accounts", value: totalAccounts },
    { label: "Total Contacts", value: totalContacts },
    { label: "Accounts with Signals", value: accountsWithSignals },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of account intelligence and GTM opportunities.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recently Added Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No accounts yet.{" "}
              <Link href="/accounts/new" className="underline">
                Add your first account
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {recentAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Link href={`/accounts/${account.id}`} className="font-medium hover:underline">
                      {account.companyName}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {account.companyType ?? "—"} · Added {account.createdAt.toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant={ACCOUNT_STATUS_BADGE_VARIANT[account.status]}>
                    {ACCOUNT_STATUS_LABELS[account.status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scoring &amp; Signal Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Scoring and signal-distribution views land once the deterministic scoring
            engine is built in a later phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
