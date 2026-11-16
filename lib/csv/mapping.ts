import type { CsvFieldDef } from "@/lib/csv/fields";

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Best-effort auto-mapping from raw CSV headers to our target field keys, by
// comparing normalized headers against each field's known aliases. Returns
// null for a header with no confident match — the user confirms/corrects
// every mapping before anything is validated or imported.
export function guessColumnMapping(
  headers: string[],
  fields: CsvFieldDef[],
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  const usedFieldKeys = new Set<string>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    let matchKey: string | null = null;
    for (const field of fields) {
      if (usedFieldKeys.has(field.key)) continue;
      if (field.aliases.some((alias) => normalizeHeader(alias) === normalized)) {
        matchKey = field.key;
        break;
      }
    }
    mapping[header] = matchKey;
    if (matchKey) usedFieldKeys.add(matchKey);
  }

  return mapping;
}

// Applies a confirmed header -> field-key mapping to raw parsed rows,
// producing rows keyed by our target field names (unmapped columns dropped).
export function applyColumnMapping(
  rawRows: Record<string, string>[],
  mapping: Record<string, string | null>,
): Record<string, string>[] {
  const entries = Object.entries(mapping).filter(([, key]) => key !== null) as [string, string][];
  return rawRows.map((row) => {
    const mapped: Record<string, string> = {};
    for (const [header, key] of entries) {
      mapped[key] = row[header] ?? "";
    }
    return mapped;
  });
}
