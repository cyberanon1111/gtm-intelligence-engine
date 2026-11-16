import { Prisma } from "@/lib/generated/prisma/client";
import type { AccountFilters } from "@/lib/validation/account";

// Extensible filter -> Prisma where-clause builder. Adding a new filter means
// adding a field to AccountFilters (lib/validation/account.ts) and a branch
// here — no other call site needs to change.
export function buildAccountWhere(filters: AccountFilters): Prisma.AccountWhereInput {
  const where: Prisma.AccountWhereInput = {};

  where.archivedAt = filters.showArchived ? { not: null } : null;

  if (filters.q) {
    where.OR = [
      { companyName: { contains: filters.q, mode: "insensitive" } },
      { website: { contains: filters.q, mode: "insensitive" } },
      { country: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  if (filters.country) where.country = filters.country;
  if (filters.companyType) where.companyType = filters.companyType;
  if (filters.status) where.status = filters.status;

  if (filters.fleetSizeMin !== undefined || filters.fleetSizeMax !== undefined) {
    where.fleetSize = {
      ...(filters.fleetSizeMin !== undefined ? { gte: filters.fleetSizeMin } : {}),
      ...(filters.fleetSizeMax !== undefined ? { lte: filters.fleetSizeMax } : {}),
    };
  }

  return where;
}

export interface AccountSearchParamsInput {
  q?: string;
  country?: string;
  companyType?: string;
  status?: string;
  fleetSizeMin?: string;
  fleetSizeMax?: string;
  showArchived?: string;
}
