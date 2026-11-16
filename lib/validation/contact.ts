import { z } from "zod";
import { isValidUrl, normalizeUrl } from "@/lib/validation/url";
import { emptyToUndefined, toOptionalInt } from "@/lib/validation/shared";

// Suggested vocabulary for the seniority select / CSV warnings. Contact.seniority
// is a free-text column in the schema (not a DB enum), so this is guidance, not
// an enforced constraint — an unrecognized value is a soft warning, never a
// hard validation error.
export const SENIORITY_SUGGESTIONS = [
  "C_LEVEL",
  "VP",
  "DIRECTOR",
  "MANAGER",
  "INDIVIDUAL_CONTRIBUTOR",
] as const;

const optionalUrlField = z
  .preprocess(emptyToUndefined, z.string().max(500).optional())
  .refine((v) => v === undefined || isValidUrl(v), {
    message: "Must be a valid URL",
  })
  .transform((v) => (v === undefined ? undefined : normalizeUrl(v)));

const optionalEmailField = z.preprocess(
  emptyToUndefined,
  z.string().trim().toLowerCase().email("Must be a valid email address").optional(),
);

const optionalInfluenceScore = z.preprocess(
  toOptionalInt,
  z
    .number({ message: "Must be a whole number" })
    .int()
    .min(0, "Must be between 0 and 100")
    .max(100, "Must be between 0 and 100")
    .optional(),
);

export const contactInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  title: z.preprocess(emptyToUndefined, z.string().trim().max(150).optional()),
  department: z.preprocess(emptyToUndefined, z.string().trim().max(150).optional()),
  linkedinUrl: optionalUrlField,
  email: optionalEmailField,
  personaId: z.preprocess(emptyToUndefined, z.string().optional()),
  seniority: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  influenceScore: optionalInfluenceScore,
});

export type ContactInput = z.infer<typeof contactInputSchema>;
