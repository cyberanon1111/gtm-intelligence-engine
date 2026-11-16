import { Badge } from "@/components/ui/badge";
import type { RowStatus } from "@/lib/csv/accountImport";

const STATUS_CONFIG: Record<RowStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  valid: { label: "Valid", variant: "default" },
  duplicate: { label: "Duplicate", variant: "secondary" },
  invalid: { label: "Invalid", variant: "destructive" },
};

export function RowStatusBadge({ status }: { status: RowStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
