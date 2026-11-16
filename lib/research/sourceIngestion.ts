import type { PrismaClient, Source } from "@/lib/generated/prisma/client";
import type { RetrievedDocument } from "@/lib/research-provider/types";
import type { AIClient } from "@/lib/ai/client";
import { runFactExtractionAgent } from "@/lib/ai/agents/factExtractionAgent";
import { classifySourceQuality } from "@/config/meridian/sourceQuality";
import { RESEARCH_PROVIDER_LIMITS } from "@/config/meridian/researchProvider";

export function inferSourceType(url: string, accountWebsite: string | null): "COMPANY_WEBSITE" | "LINKEDIN" | "NEWS" {
  const lower = url.toLowerCase();
  if (lower.includes("linkedin.com")) return "LINKEDIN";
  if (accountWebsite) {
    try {
      if (lower.includes(new URL(accountWebsite).hostname)) return "COMPANY_WEBSITE";
    } catch {
      // malformed accountWebsite — fall through
    }
  }
  return "NEWS";
}

// Defense in depth: cap content length regardless of whether the provider
// already truncated it — every document's content passes through this
// before it's persisted OR reaches a prompt, never one without the other.
export function capContent(content: string): string {
  return content.length > RESEARCH_PROVIDER_LIMITS.maxContentChars
    ? content.slice(0, RESEARCH_PROVIDER_LIMITS.maxContentChars) + "\n\n[truncated]"
    : content;
}

// Sources are never silently replaced: the same URL found again reuses the
// existing row (and its original rawContent) rather than overwriting it —
// this preserves provenance of what was actually retrieved the first time.
export async function resolveOrCreateSource(
  db: PrismaClient,
  doc: RetrievedDocument,
  accountWebsite: string | null,
): Promise<Source> {
  const existing = await db.source.findFirst({ where: { url: doc.url } });
  if (existing) return existing;

  const sourceType = inferSourceType(doc.url, accountWebsite);

  return db.source.create({
    data: {
      url: doc.url,
      name: doc.title,
      publisher: doc.publisher ?? null,
      publishedAt: doc.publishedAt ? new Date(doc.publishedAt) : null,
      retrievedAt: doc.retrievedAt ? new Date(doc.retrievedAt) : new Date(),
      sourceType,
      quality: classifySourceQuality(sourceType, doc.url),
      rawContent: capContent(doc.content),
    },
  });
}

export interface IngestDocumentResult {
  source: Source;
  factIds: string[];
}

// One document -> one Source row + N Fact rows, via the Fact Extraction
// Agent. Never throws on an extraction failure — errors are the caller's
// (researchRun.ts) concern to record per-document, so one bad document
// doesn't abort the whole run.
export async function ingestDocument(
  db: PrismaClient,
  aiClient: AIClient,
  params: { accountId: string; accountCompanyName: string; accountWebsite: string | null; document: RetrievedDocument },
): Promise<IngestDocumentResult> {
  const source = await resolveOrCreateSource(db, params.document, params.accountWebsite);

  const extraction = await runFactExtractionAgent(aiClient, {
    accountCompanyName: params.accountCompanyName,
    documentTitle: params.document.title,
    documentContent: capContent(params.document.content),
  });

  const factIds: string[] = [];
  for (const fact of extraction.facts) {
    const created = await db.fact.create({
      data: {
        sourceId: source.id,
        accountId: params.accountId,
        statement: fact.statement,
        confidence: fact.confidence,
        context: fact.context ?? null,
      },
    });
    factIds.push(created.id);
  }

  return { source, factIds };
}
