// Normalizes a user- or CSV-provided URL string (which may be missing a
// protocol, e.g. "example.com") and validates it. Returns null for empty
// input, or the normalized URL string, or throws if the value is malformed.

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol); // throws on malformed input
  if (!url.hostname.includes(".")) {
    throw new Error("URL must include a valid domain");
  }
  return url.toString();
}

export function isValidUrl(raw: string): boolean {
  try {
    normalizeUrl(raw);
    return true;
  } catch {
    return false;
  }
}
