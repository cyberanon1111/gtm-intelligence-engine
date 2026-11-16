import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SignalFilters } from "@/components/signals/signal-filters";
import { getSignalFreshnessLabel } from "@/lib/signals/freshness";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  EXPIRED: "outline",
  ARCHIVED: "secondary",
};

const FRESHNESS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  FRESH: "default",
  AGING: "secondary",
  STALE: "outline",
};

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const type = typeof params.type === "string" ? params.type : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;

  const [signals, types] = await Promise.all([
    prisma.signal.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(status ? { status: status as never } : {}),
        ...(q
          ? {
              account: { companyName: { contains: q, mode: "insensitive" } },
            }
          : {}),
      },
      include: { account: { select: { id: true, companyName: true } } },
      orderBy: { detectedAt: "desc" },
      take: 200,
    }),
    prisma.signal.findMany({ select: { type: true }, distinct: ["type"], orderBy: { type: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Signals</h1>
        <p className="text-sm text-muted-foreground">
          {signals.length} signal{signals.length === 1 ? "" : "s"} across all accounts.
        </p>
      </div>

      <SignalFilters types={types.map((t) => t.type)} />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Strength</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Freshness</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {signals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                  No signals match these filters.
                </TableCell>
              </TableRow>
            ) : (
              signals.map((signal) => {
                const freshness = getSignalFreshnessLabel(signal);
                return (
                <TableRow key={signal.id}>
                  <TableCell className="font-medium">
                    <Link href={`/accounts/${signal.account.id}`} className="hover:underline">
                      {signal.account.companyName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{signal.type}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate">{signal.title}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {signal.detectedAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{signal.confidence}%</TableCell>
                  <TableCell className="text-muted-foreground">{signal.strength}/5</TableCell>
                  <TableCell className="max-w-[160px] truncate text-muted-foreground">
                    {signal.sourceName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[signal.status] ?? "outline"}>{signal.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={FRESHNESS_VARIANT[freshness] ?? "outline"}>{freshness}</Badge>
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
