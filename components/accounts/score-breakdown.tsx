import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { DIMENSION_MAX } from "@/lib/scoring/constants";
import type { ScoreComponentDetails } from "@/lib/scoring/types";

interface ScoreBreakdownProps {
  total: number;
  icpFit: number;
  signalStrength: number;
  problemRelevance: number;
  buyingPersona: number;
  engagement: number;
  scoringVersion: string;
  computedAt: Date;
  details: ScoreComponentDetails;
}

export function ScoreBreakdown({
  total,
  icpFit,
  signalStrength,
  problemRelevance,
  buyingPersona,
  engagement,
  scoringVersion,
  computedAt,
  details,
}: ScoreBreakdownProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-muted-foreground">GTM Score</span>
          <span className="text-xs text-muted-foreground">
            {scoringVersion} · {computedAt.toLocaleString()}
          </span>
        </div>
        <div className="text-4xl font-semibold tracking-tight">{total}/100</div>
        <Progress value={total} className="mt-2 h-2" />
      </div>

      <Separator />

      <DimensionSection
        label="ICP Fit"
        points={icpFit}
        max={DIMENSION_MAX.ICP_FIT}
      >
        <ul className="flex flex-col gap-1.5">
          {details.icpFit.rules.map((rule) => (
            <li key={rule.rule} className="flex items-start gap-2 text-xs">
              <Badge variant={rule.matched ? "default" : "outline"} className="mt-0.5 shrink-0">
                {rule.matched ? `+${rule.points}` : "0"}
              </Badge>
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{rule.rule}</span> — {rule.explanation}
              </span>
            </li>
          ))}
        </ul>
      </DimensionSection>

      <DimensionSection
        label="Signal Strength"
        points={signalStrength}
        max={DIMENSION_MAX.SIGNAL_STRENGTH}
      >
        {details.signalStrength.signals.length === 0 ? (
          <EmptyNote text="No non-engagement signals detected for this account." />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {details.signalStrength.signals.map((s) => (
              <li key={s.signalId} className="flex items-start gap-2 text-xs">
                <Badge variant={s.counted ? "default" : "outline"} className="mt-0.5 shrink-0">
                  {s.counted ? `+${Math.round(s.effectivePoints)}` : "0"}
                </Badge>
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{s.title}</span> ({s.category}) —{" "}
                  {s.expired
                    ? "expired"
                    : `${s.ageDays}d old, ${Math.round(s.decayFactor * 100)}% strength remaining`}
                  {!s.counted && s.effectivePoints > 0 ? " · not in top signals counted" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DimensionSection>

      <DimensionSection
        label="Problem Relevance"
        points={problemRelevance}
        max={DIMENSION_MAX.PROBLEM_RELEVANCE}
      >
        {details.problemRelevance.matchedProblems.length === 0 ? (
          <EmptyNote text="No signals map to a known problem yet." />
        ) : (
          <ul className="flex flex-col gap-2">
            {details.problemRelevance.matchedProblems.map((p) => (
              <li key={p.problemKey} className="text-xs">
                <div className="font-medium text-foreground">{p.label}</div>
                <div className="text-muted-foreground">{p.description}</div>
                <div className="mt-0.5 text-muted-foreground">
                  Evidenced by {p.evidenceSignalIds.length} signal(s)
                  {p.relevantProducts.length > 0 &&
                    ` · Relevant product: ${p.relevantProducts.map((prod) => prod.name).join(", ")}`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DimensionSection>

      <DimensionSection
        label="Buying Persona"
        points={buyingPersona}
        max={DIMENSION_MAX.BUYING_PERSONA}
      >
        {details.buyingPersona.matchedContacts.length === 0 ? (
          <EmptyNote text="No contacts with a relevant assigned persona." />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {details.buyingPersona.matchedContacts.map((c) => (
              <li key={c.contactId} className="flex items-start gap-2 text-xs">
                <Badge
                  variant={c.contactId === details.buyingPersona.winningContactId ? "default" : "outline"}
                  className="mt-0.5 shrink-0"
                >
                  +{c.points}
                </Badge>
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{c.name}</span> — {c.personaName} (
                  {c.seniorityTier})
                </span>
              </li>
            ))}
          </ul>
        )}
      </DimensionSection>

      <DimensionSection label="Engagement" points={engagement} max={DIMENSION_MAX.ENGAGEMENT}>
        {details.engagement.chosen === "none" ? (
          <EmptyNote text="No engagement signal or activity outcome recorded yet." />
        ) : details.engagement.chosen === "signal" && details.engagement.signalContribution ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {details.engagement.signalContribution.title}
            </span>{" "}
            ({details.engagement.signalContribution.type}) — +{details.engagement.signalContribution.points}
          </p>
        ) : details.engagement.outcomeContribution ? (
          <p className="text-xs text-muted-foreground">
            Activity outcome:{" "}
            <span className="font-medium text-foreground">
              {details.engagement.outcomeContribution.type}
            </span>{" "}
            — +{details.engagement.outcomeContribution.points}
          </p>
        ) : null}
      </DimensionSection>
    </div>
  );
}

function DimensionSection({
  label,
  points,
  max,
  children,
}: {
  label: string;
  points: number;
  max: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {points}/{max}
        </span>
      </div>
      <Progress value={(points / max) * 100} className="h-1.5" />
      {children}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}
