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
import type { ScoreComponentDetails } from "@/lib/scoring/types";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const accounts = await prisma.account.findMany({
    where: { archivedAt: null, currentScore: { not: null } },
    orderBy: { currentScore: "desc" },
    include: {
      signals: { orderBy: { detectedAt: "desc" }, take: 1 },
      scores: { orderBy: { computedAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="text-sm text-muted-foreground">
          Accounts ranked by total GTM score, with the factors that contributed to it.
        </p>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Total Score</TableHead>
              <TableHead>ICP Fit</TableHead>
              <TableHead>Latest Signal</TableHead>
              <TableHead>Relevant Product</TableHead>
              <TableHead>Relevant Persona</TableHead>
              <TableHead>Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No scored accounts yet. Scores are computed when an account is created,
                  imported, or edited, or via &ldquo;Recalculate Score&rdquo; on the account page.
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => {
                const latestSignal = account.signals[0];
                const score = account.scores[0];
                const details = score?.componentDetails as unknown as
                  | ScoreComponentDetails
                  | undefined;
                const relevantProducts = new Set(
                  details?.problemRelevance.matchedProblems.flatMap((p) =>
                    p.relevantProducts.map((prod) => prod.name),
                  ) ?? [],
                );
                const winningContact = details?.buyingPersona.matchedContacts.find(
                  (c) => c.contactId === details.buyingPersona.winningContactId,
                );

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
                    <TableCell>
                      <Badge variant="default">{account.currentScore}/100</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{account.icpScore ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {latestSignal ? latestSignal.title : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {relevantProducts.size > 0 ? [...relevantProducts].join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {winningContact ? `${winningContact.name} (${winningContact.personaName})` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {account.updatedAt.toLocaleDateString()}
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
