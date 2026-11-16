// The seam between the app and whatever external search/retrieval vendor is
// wired in. Business logic (lib/research/*) depends on this interface only —
// never a specific vendor's SDK or response shape — exactly mirroring how
// lib/ai/client.ts decouples the AI agents from Anthropic specifically.

export interface RetrievedDocument {
  url: string;
  title: string;
  publisher?: string;
  publishedAt?: string; // ISO date string, if the provider can determine one
  retrievedAt?: string; // ISO date string; when omitted, callers stamp "now" at persistence
  content: string; // raw or extracted text content — untrusted input, see lib/ai/prompts/factExtraction.ts
}

// Distinguishes failure modes so the research run can record something
// honest ("Tavily rate limit exceeded") instead of a generic message, and so
// callers can decide what's retry-worthy (TIMEOUT/UNAVAILABLE) versus not
// (AUTH/RATE_LIMIT — retrying immediately won't help).
export type ResearchProviderErrorKind =
  | "AUTH"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "UNAVAILABLE"
  | "MALFORMED_RESPONSE"
  | "NOT_CONFIGURED"
  | "UNKNOWN";

export class ResearchProviderError extends Error {
  kind: ResearchProviderErrorKind;
  constructor(message: string, kind: ResearchProviderErrorKind = "UNKNOWN", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ResearchProviderError";
    this.kind = kind;
  }
}

export interface ResearchProvider {
  search(input: { companyName: string; website: string | null }): Promise<RetrievedDocument[]>;
}
