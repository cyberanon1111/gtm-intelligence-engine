import type { AccountStatus } from "@/lib/generated/prisma/enums";

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  NEW: "New",
  RESEARCHING: "Researching",
  QUALIFIED: "Qualified",
  OPPORTUNITY: "Opportunity",
  CUSTOMER: "Customer",
  DISQUALIFIED: "Disqualified",
  DORMANT: "Dormant",
};

export const ACCOUNT_STATUS_BADGE_VARIANT: Record<
  AccountStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  NEW: "outline",
  RESEARCHING: "secondary",
  QUALIFIED: "secondary",
  OPPORTUNITY: "default",
  CUSTOMER: "default",
  DISQUALIFIED: "destructive",
  DORMANT: "outline",
};
