import { z } from "zod";
import { contactInputSchema } from "@/lib/validation/contact";
import { emptyToUndefined } from "@/lib/validation/shared";

const contactCsvSchema = contactInputSchema.omit({ personaId: true }).extend({
  accountCompanyName: z.string().trim().min(1, "Account / company name is required"),
  persona: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type RowStatus = "valid" | "invalid" | "duplicate";

export interface ContactImportRow {
  accountId: string;
  name: string;
  title?: string;
  department?: string;
  linkedinUrl?: string;
  email?: string;
  personaId?: string;
  seniority?: string;
  influenceScore?: number;
}

export interface ContactRowResult {
  rowIndex: number;
  values: Record<string, string>;
  status: RowStatus;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  data?: ContactImportRow;
}

export function validateContactRows(
  rows: Record<string, string>[],
  accountsByName: Record<string, string>, // lowercased companyName -> accountId
  personasByName: Record<string, string>, // lowercased persona name -> personaId
  existingEmailsByAccount: Record<string, string[]>, // accountId -> lowercased existing emails
): ContactRowResult[] {
  const seenEmails = new Set<string>();

  return rows.map((values, rowIndex) => {
    const parsed = contactCsvSchema.safeParse(values);
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};
    let accountId: string | undefined;

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "name");
        if (!errors[key]) errors[key] = issue.message;
      }
    } else {
      const normalizedAccountName = parsed.data.accountCompanyName.trim().toLowerCase();
      accountId = accountsByName[normalizedAccountName];
      if (!accountId) {
        errors.accountCompanyName = `No existing account named "${parsed.data.accountCompanyName}"`;
      }
    }

    let personaId: string | undefined;
    if (parsed.success && parsed.data.persona) {
      personaId = personasByName[parsed.data.persona.trim().toLowerCase()];
      if (!personaId) {
        warnings.persona = `Unknown persona "${parsed.data.persona}" — will be left unassigned`;
      }
    }

    let isDuplicate = false;
    const email = parsed.success ? parsed.data.email : undefined;
    if (email) {
      if (seenEmails.has(email)) isDuplicate = true;
      seenEmails.add(email);
      if (accountId && existingEmailsByAccount[accountId]?.includes(email)) {
        isDuplicate = true;
      }
    }

    const status: RowStatus =
      Object.keys(errors).length > 0 ? "invalid" : isDuplicate ? "duplicate" : "valid";

    const data: ContactImportRow | undefined =
      parsed.success && accountId
        ? {
            accountId,
            name: parsed.data.name,
            title: parsed.data.title,
            department: parsed.data.department,
            linkedinUrl: parsed.data.linkedinUrl,
            email: parsed.data.email,
            personaId,
            seniority: parsed.data.seniority,
            influenceScore: parsed.data.influenceScore,
          }
        : undefined;

    return { rowIndex, values, status, errors, warnings, data };
  });
}
