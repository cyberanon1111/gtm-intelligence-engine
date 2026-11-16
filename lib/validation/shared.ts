// Shared preprocessing helpers used across account/contact/CSV validation.

export function emptyToUndefined(val: unknown): unknown {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "string" && val.trim() === "") return undefined;
  return val;
}

export function toStringList(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof val === "string") {
    return val
      .split(/[,|;]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

export function toOptionalInt(val: unknown): unknown {
  const cleaned = emptyToUndefined(val);
  if (cleaned === undefined) return undefined;
  if (typeof cleaned === "number") return cleaned;
  const n = Number(String(cleaned).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : cleaned; // pass through invalid values so zod reports the type error
}
