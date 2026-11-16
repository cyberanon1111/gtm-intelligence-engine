import { Badge } from "@/components/ui/badge";

const CONFIG: Record<string, { label: string; variant: "outline" | "secondary" | "default" }> = {
  FACT: { label: "Sourced fact", variant: "outline" },
  INFERENCE: { label: "AI inference", variant: "secondary" },
  RECOMMENDATION: { label: "Recommendation", variant: "default" },
};

export function ClaimTypeBadge({ claimType }: { claimType: string }) {
  const config = CONFIG[claimType] ?? { label: claimType, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
