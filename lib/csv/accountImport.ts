import { accountInputSchema, type AccountInput } from "@/lib/validation/account";

export type RowStatus = "valid" | "invalid" | "duplicate";

export interface AccountRowResult {
  rowIndex: number;
  values: Record<string, string>;
  status: RowStatus;
  errors: Record<string, string>;
  data?: AccountInput;
}

// existingCompanyNames must be lowercased/trimmed already.
export function validateAccountRows(
  rows: Record<string, string>[],
  existingCompanyNames: Set<string>,
): AccountRowResult[] {
  const seenInFile = new Set<string>();

  return rows.map((values, rowIndex) => {
    const parsed = accountInputSchema.safeParse(values);
    const errors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "companyName");
        if (!errors[key]) errors[key] = issue.message;
      }
    }

    const normalizedName = values.companyName?.trim().toLowerCase();
    let isDuplicate = false;
    if (normalizedName) {
      if (seenInFile.has(normalizedName) || existingCompanyNames.has(normalizedName)) {
        isDuplicate = true;
      }
      seenInFile.add(normalizedName);
    }

    const status: RowStatus =
      Object.keys(errors).length > 0 ? "invalid" : isDuplicate ? "duplicate" : "valid";

    return { rowIndex, values, status, errors, data: parsed.success ? parsed.data : undefined };
  });
}
