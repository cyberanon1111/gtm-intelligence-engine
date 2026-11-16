import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import type { EvidenceItem } from "@/lib/ai/schemas/evidence";

function inferSourceType(item: EvidenceItem, accountWebsite: string | null): Prisma.SourceCreateInput["sourceType"] {
  const url = item.sourceUrl?.toLowerCase();
  if (!url) return "OTHER";
  if (url.includes("linkedin.com")) return "LINKEDIN";
  if (accountWebsite) {
    try {
      if (url.includes(new URL(accountWebsite).hostname)) return "COMPANY_WEBSITE";
    } catch {
      // malformed accountWebsite — fall through to the generic classification
    }
  }
  if (item.sourceName.toLowerCase().includes("press release")) return "PRESS_RELEASE";
  return "NEWS";
}

async function resolveSourceId(
  db: PrismaClient,
  item: EvidenceItem,
  accountWebsite: string | null,
): Promise<string> {
  const existing = item.sourceUrl
    ? await db.source.findFirst({ where: { url: item.sourceUrl } })
    : await db.source.findFirst({ where: { url: null, name: item.sourceName } });

  if (existing) return existing.id;

  const created = await db.source.create({
    data: {
      url: item.sourceUrl ?? null,
      name: item.sourceName,
      publisher: item.publisher ?? null,
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
      sourceType: inferSourceType(item, accountWebsite),
    },
  });
  return created.id;
}

// Persists an AI agent's evidence array as real Evidence rows (resolving or
// creating a deduplicated Source per item), tied to the given insight and
// account. Never overwrites — each run's evidence is additive.
export async function persistEvidence(
  db: PrismaClient,
  params: { accountId: string; insightId: string; accountWebsite: string | null; items: EvidenceItem[] },
): Promise<void> {
  for (const item of params.items) {
    const sourceId = await resolveSourceId(db, item, params.accountWebsite);
    await db.evidence.create({
      data: {
        sourceId,
        accountId: params.accountId,
        insightId: params.insightId,
        claim: item.claim,
        claimType: item.claimType,
        confidence: item.confidence,
      },
    });
  }
}
