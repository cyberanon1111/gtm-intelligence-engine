import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AnalyticsBucket } from "@/lib/analytics/gtmAnalytics";

// A plain, alphabetically-sorted table — deliberately not sorted by any
// metric and never labeled "top"/"best"/"worst" (Phase 6 section 7). Rates
// are shown only when there's at least one sent activation to compute them
// against; otherwise "—", never a fabricated 0%.
export function AnalyticsTable({ keyLabel, buckets }: { keyLabel: string; buckets: AnalyticsBucket[] }) {
  if (buckets.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{keyLabel}</TableHead>
          <TableHead className="text-right">Accounts</TableHead>
          <TableHead className="text-right">Activations</TableHead>
          <TableHead className="text-right">Sent</TableHead>
          <TableHead className="text-right">Replies</TableHead>
          <TableHead className="text-right">Positive replies</TableHead>
          <TableHead className="text-right">Meetings</TableHead>
          <TableHead className="text-right">Opportunities</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {buckets.map((b) => (
          <TableRow key={b.key}>
            <TableCell className="font-medium">{b.key}</TableCell>
            <TableCell className="text-right">{b.accounts}</TableCell>
            <TableCell className="text-right">{b.activations}</TableCell>
            <TableCell className="text-right">{b.sentActivations}</TableCell>
            <TableCell className="text-right">
              {b.replies}
              {b.replyRatePct !== null && <span className="text-muted-foreground"> ({b.replyRatePct}%)</span>}
            </TableCell>
            <TableCell className="text-right">
              {b.positiveReplies}
              {b.positiveReplyRatePct !== null && (
                <span className="text-muted-foreground"> ({b.positiveReplyRatePct}%)</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              {b.meetings}
              {b.meetingRatePct !== null && <span className="text-muted-foreground"> ({b.meetingRatePct}%)</span>}
            </TableCell>
            <TableCell className="text-right">{b.opportunities}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
