import type { ResearchProvider, RetrievedDocument } from "@/lib/research-provider/types";

// A fake ResearchProvider for tests (and local development without a real
// vendor configured) — returns canned documents instead of calling any
// network service, so nothing under lib/research/ needs live external
// access to be exercised.
export function createMockResearchProvider(
  documents: RetrievedDocument[] | (() => RetrievedDocument[]) | Error,
): ResearchProvider {
  return {
    async search() {
      if (documents instanceof Error) throw documents;
      return typeof documents === "function" ? documents() : documents;
    },
  };
}
