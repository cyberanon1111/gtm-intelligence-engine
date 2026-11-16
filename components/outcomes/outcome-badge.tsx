import { Badge } from "@/components/ui/badge";
import { getOutcomeEventTypeDefinition } from "@/config/meridian/outcomeTypes";

const GROUP_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  delivery: "outline",
  reply: "secondary",
  meeting: "default",
  opportunity: "default",
  other: "outline",
};

export function OutcomeBadge({ type }: { type: string }) {
  const def = getOutcomeEventTypeDefinition(type);
  const variant = def ? GROUP_VARIANT[def.group] : "outline";
  return <Badge variant={variant}>{def?.label ?? type.replace(/_/g, " ")}</Badge>;
}
