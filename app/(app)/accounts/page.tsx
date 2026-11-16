import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ACCOUNT_STATUS_BADGE_VARIANT, ACCOUNT_STATUS_LABELS } from "@/lib/labels";
import { accountFilterSchema } from "@/lib/validation/account";
import { buildAccountWhere } from "@/lib/accounts/query";
import { AccountFilters } from "@/components/accounts/account-filters";
import { ArchiveToggleButton } from "@/components/accounts/account-actions";

export const dynamic = "force-dynamic";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const singleValued = Object.fromEntries(
    Object.entries(rawParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const filters = accountFilterSchema.parse(singleValued);
  const where = buildAccountWhere(filters);

  const [accounts, countryRows, companyTypeRows] = await Promise.all([
    prisma.account.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { signals: { orderBy: { detectedAt: "desc" }, take: 1 } },
    }),
    prisma.account.findMany({
      where: { country: { not: null } },
      select: { country: true },
      distinct: ["country"],
      orderBy: { country: "asc" },
    }),
    prisma.account.findMany({
      where: { companyType: { not: null } },
      select: { companyType: true },
      distinct: ["companyType"],
      orderBy: { companyType: "asc" },
    }),
  ]);

  const countries = countryRows.map((r) => r.country).filter((c): c is string => !!c);
  const companyTypes = companyTypeRows
    .map((r) => r.companyType)
    .filter((c): c is string => !!c);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            {accounts.length} account{accounts.length === 1 ? "" : "s"}
            {filters.showArchived ? " (archived)" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/import" />}>
            <Upload className="size-4" /> Import CSV
          </Button>
          <Button render={<Link href="/accounts/new" />}>
            <Plus className="size-4" /> New Account
          </Button>
        </div>
      </div>

      <AccountFilters countries={countries} companyTypes={companyTypes} />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>ICP Fit</TableHead>
              <TableHead>Current Score</TableHead>
              <TableHead>Latest Signal</TableHead>
              <TableHead>Relevant Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  {filters.q || filters.country || filters.companyType || filters.status ? (
                    <>No accounts match these filters.</>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <span>No accounts yet.</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" render={<Link href="/import" />}>
                          Import a CSV
                        </Button>
                        <Button size="sm" render={<Link href="/accounts/new" />}>
                          Add an account
                        </Button>
                      </div>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => {
                const latestSignal = account.signals[0];
                return (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      <Link href={`/accounts/${account.id}`} className="hover:underline">
                        {account.companyName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {account.companyType ?? "—"}
                        {account.country ? ` · ${account.country}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>{account.icpScore ?? "—"}</TableCell>
                    <TableCell>{account.currentScore ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {latestSignal ? latestSignal.title : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell>
                      <Badge variant={ACCOUNT_STATUS_BADGE_VARIANT[account.status]}>
                        {ACCOUNT_STATUS_LABELS[account.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {account.updatedAt.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          render={<Link href={`/accounts/${account.id}/edit`} />}
                        >
                          Edit
                        </Button>
                        <ArchiveToggleButton
                          accountId={account.id}
                          archived={!!account.archivedAt}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
