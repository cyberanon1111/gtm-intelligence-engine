import { z } from "zod";
import { isValidUrl, normalizeUrl } from "@/lib/validation/url";
import { emptyToUndefined, toOptionalInt, toStringList } from "@/lib/validation/shared";

export const ACCOUNT_STATUS_VALUES = [
  "NEW",
  "RESEARCHING",
  "QUALIFIED",
  "OPPORTUNITY",
  "CUSTOMER",
  "DISQUALIFIED",
  "DORMANT",
] as const;

const optionalUrlField = z
  .preprocess(emptyToUndefined, z.string().max(500).optional())
  .refine((v) => v === undefined || isValidUrl(v), {
    message: "Must be a valid URL (e.g. company.com or https://company.com)",
  })
  .transform((v) => (v === undefined ? undefined : normalizeUrl(v)));

const optionalIntField = z.preprocess(
  toOptionalInt,
  z
    .number({ message: "Must be a whole number" })
    .int("Must be a whole number")
    .min(0, "Cannot be negative")
    .max(100_000, "Value looks too large — check for a typo")
    .optional(),
);

export const accountInputSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(200, "Company name is too long"),
  website: optionalUrlField,
  country: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  companyType: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  fleetSize: optionalIntField,
  vesselTypes: z.preprocess(toStringList, z.array(z.string().max(60))).default([]),
  regions: z.preprocess(toStringList, z.array(z.string().max(60))).default([]),
  status: z
    .preprocess(emptyToUndefined, z.enum(ACCOUNT_STATUS_VALUES).optional())
    .default("NEW"),
});

export type AccountInput = z.infer<typeof accountInputSchema>;

export const accountFilterSchema = z.object({
  q: z.string().trim().max(200).optional(),
  country: z.string().trim().max(100).optional(),
  companyType: z.string().trim().max(100).optional(),
  status: z.preprocess(emptyToUndefined, z.enum(ACCOUNT_STATUS_VALUES).optional()),
  fleetSizeMin: optionalIntField,
  fleetSizeMax: optionalIntField,
  showArchived: z
    .preprocess((v) => v === "true" || v === true, z.boolean())
    .default(false),
});

export type AccountFilters = z.infer<typeof accountFilterSchema>;
