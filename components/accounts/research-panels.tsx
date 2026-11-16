import { Badge } from "@/components/ui/badge";
import { AiInterpretationPanel } from "@/components/accounts/ai-interpretation-panel";
import { ClaimTypeBadge } from "@/components/accounts/claim-type-badge";
import type { ResearchResult } from "@/lib/ai/schemas/research";
import type { WhyNowResult } from "@/lib/ai/schemas/whyNow";

export function ResearchSummaryPanel({
  research,
  generatedAt,
}: {
  research: ResearchResult;
  generatedAt: Date;
}) {
  const bullets: [string, string[]][] = [
    ["Recent Developments", research.recentDevelopments],
    ["Leadership Changes", research.leadershipChanges],
    ["Relevant Compliance", research.relevantCompliance],
    ["Technology Signals", research.technologySignals],
  ];

  return (
    <AiInterpretationPanel>
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-xs text-muted-foreground">Last researched {generatedAt.toLocaleString()}</p>
        <Field label="Company Summary" value={research.companySummary} />
        <Field label="Fleet Profile" value={research.fleetProfile} />
        {bullets.map(([label, items]) => (
          <div key={label}>
            <div className="font-medium">{label}</div>
            {items.length === 0 ? (
              <p className="text-muted-foreground">UNKNOWN</p>
            ) : (
              <ul className="list-inside list-disc text-muted-foreground">
                {items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </AiInterpretationPanel>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-medium">{label}</div>
      <p className="text-muted-foreground">{value}</p>
    </div>
  );
}

export function WhyNowPanel({ whyNow, generatedAt }: { whyNow: WhyNowResult; generatedAt: Date }) {
  return (
    <AiInterpretationPanel>
      <div className="flex flex-col gap-2 text-sm">
        <p className="text-xs text-muted-foreground">Generated {generatedAt.toLocaleString()}</p>
        <p>{whyNow.whyNow}</p>
        <p className="text-xs text-muted-foreground">Confidence: {whyNow.confidence}%</p>
      </div>
    </AiInterpretationPanel>
  );
}

export function PotentialProblemsPanel({ whyNow }: { whyNow: WhyNowResult }) {
  if (whyNow.potentialProblems.length === 0) {
    return <p className="text-sm text-muted-foreground">No problems matched the deterministic scoring data.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {whyNow.potentialProblems.map((p) => (
        <div key={p.problemKey} className="text-sm">
          <div className="font-medium">{p.label}</div>
          <p className="text-muted-foreground">{p.rationale}</p>
        </div>
      ))}
    </div>
  );
}

export function RelevantProductsPanel({ whyNow }: { whyNow: WhyNowResult }) {
  if (whyNow.relevantProducts.length === 0) {
    return <p className="text-sm text-muted-foreground">No product match yet.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {whyNow.relevantProducts.map((p) => (
        <div key={p.productName} className="text-sm">
          <div className="font-medium">{p.productName}</div>
          <p className="text-muted-foreground">{p.rationale}</p>
        </div>
      ))}
    </div>
  );
}

export function RelevantPersonasPanel({ whyNow }: { whyNow: WhyNowResult }) {
  if (whyNow.relevantPersonas.length === 0) {
    return <p className="text-sm text-muted-foreground">No persona relevance identified yet.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {whyNow.relevantPersonas.map((p) => (
        <div key={p.personaName} className="text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">{p.personaName}</span>
            <Badge variant="outline">{p.stakeholderLabel}</Badge>
          </div>
          <p className="text-muted-foreground">{p.rationale}</p>
        </div>
      ))}
    </div>
  );
}

export function RecommendedActionPanel({ whyNow }: { whyNow: WhyNowResult }) {
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
      <div className="mb-2">
        <ClaimTypeBadge claimType="RECOMMENDATION" />
      </div>
      <p className="text-sm">{whyNow.recommendedNextStep}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        A suggestion for a human to act on — not an automated action.
      </p>
    </div>
  );
}

interface EvidenceRow {
  id: string;
  claim: string;
  claimType: string;
  confidence: number | null;
  source: { name: string; url: string | null; publisher: string | null };
}

export function EvidencePanel({ evidence }: { evidence: EvidenceRow[] }) {
  if (evidence.length === 0) {
    return <p className="text-sm text-muted-foreground">No evidence recorded yet.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {evidence.map((e) => (
        <div key={e.id} className="flex flex-col gap-1 border-b pb-3 text-sm last:border-0 last:pb-0">
          <div className="flex items-center justify-between gap-2">
            <ClaimTypeBadge claimType={e.claimType} />
            {e.confidence !== null && (
              <span className="text-xs text-muted-foreground">{e.confidence}% confidence</span>
            )}
          </div>
          <p>{e.claim}</p>
          <p className="text-xs text-muted-foreground">
            Source:{" "}
            {e.source.url ? (
              <a href={e.source.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {e.source.name}
              </a>
            ) : (
              e.source.name
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
