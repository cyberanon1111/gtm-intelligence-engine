import { Badge } from "@/components/ui/badge";
import { getActivationChannelDefinition } from "@/config/meridian/activationChannels";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  PENDING_REVIEW: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  SENT: "default",
  CANCELLED: "secondary",
};

export function ActivationStatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{status.replace(/_/g, " ")}</Badge>;
}

export function ActivationChannelBadge({ channel }: { channel: string }) {
  const def = getActivationChannelDefinition(channel);
  return <Badge variant="outline">{def?.label ?? channel}</Badge>;
}
