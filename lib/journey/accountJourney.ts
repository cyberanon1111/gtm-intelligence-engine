import type { PrismaClient } from "@/lib/generated/prisma/client";
import { getActivationChannelDefinition } from "@/config/meridian/activationChannels";
import { getOutcomeEventTypeDefinition } from "@/config/meridian/outcomeTypes";

export type JourneyEntryType =
  | "SIGNAL_DETECTED"
  | "SCORE_COMPUTED"
  | "RESEARCH_RUN"
  | "ACTIVATION_GENERATED"
  | "ACTIVATION_APPROVED"
  | "ACTIVATION_SENT"
  | "OUTCOME";

export interface JourneyEntry {
  type: JourneyEntryType;
  occurredAt: Date;
  summary: string;
  // Only ever a plain restatement of stored fields — never an inferred cause
  // (Phase 6 section 5/9: "do not invent causality"). `context` is included
  // only when it is independently, unambiguously known (e.g. a Score row
  // whose value exactly matches a ResearchRun's own recorded scoreAfter for
  // this account); otherwise it is omitted rather than guessed.
  context?: string;
}

// Pulls together every table that already records a real, timestamped GTM
// event and merges them into one feed. This performs no writes and derives
// nothing that wasn't already an explicit column somewhere — it is a read
// aggregation, not a new source of truth.
export async function getAccountJourney(db: PrismaClient, accountId: string): Promise<JourneyEntry[]> {
  const [signals, scores, researchRuns, activations, outcomes] = await Promise.all([
    db.signal.findMany({ where: { accountId }, orderBy: { detectedAt: "asc" } }),
    db.score.findMany({ where: { accountId }, orderBy: { computedAt: "asc" } }),
    db.researchRun.findMany({ where: { accountId }, orderBy: { startedAt: "asc" } }),
    db.activation.findMany({ where: { accountId }, orderBy: { createdAt: "asc" } }),
    db.outcomeEvent.findMany({ where: { accountId }, orderBy: { occurredAt: "asc" } }),
  ]);

  const entries: JourneyEntry[] = [];

  for (const signal of signals) {
    entries.push({
      type: "SIGNAL_DETECTED",
      occurredAt: signal.detectedAt,
      summary: `Signal detected: ${signal.title} (${signal.type})`,
    });
  }

  scores.forEach((score, i) => {
    const previous = i > 0 ? scores[i - 1] : null;
    const summary = previous
      ? `Score computed: ${previous.total} -> ${score.total}`
      : `Score computed: ${score.total}`;

    // Only claim "via research run" when a run for this account recorded
    // exactly this score value as its own after-state at essentially the
    // same moment — anything looser would be an invented cause.
    const matchingRun = researchRuns.find(
      (r) => r.scoreAfter === score.total && r.completedAt && Math.abs(r.completedAt.getTime() - score.computedAt.getTime()) < 5000,
    );

    entries.push({
      type: "SCORE_COMPUTED",
      occurredAt: score.computedAt,
      summary,
      context: matchingRun ? "Recalculated as part of a research run" : undefined,
    });
  });

  for (const run of researchRuns) {
    entries.push({
      type: "RESEARCH_RUN",
      occurredAt: run.startedAt,
      summary: `Research run ${run.status.toLowerCase()}: ${run.sourcesFound} source(s), ${run.factsExtracted} fact(s), ${run.signalsDetected} signal(s) detected`,
      context:
        run.scoreBefore !== null && run.scoreAfter !== null && run.scoreBefore !== run.scoreAfter
          ? `Score ${run.scoreBefore} -> ${run.scoreAfter}`
          : undefined,
    });
  }

  for (const activation of activations) {
    const channelLabel = getActivationChannelDefinition(activation.channel)?.label ?? activation.channel;
    entries.push({
      type: "ACTIVATION_GENERATED",
      occurredAt: activation.createdAt,
      summary: `${channelLabel} activation generated (v${activation.version}): "${activation.objective}"`,
    });
    if (activation.approvedAt) {
      entries.push({
        type: "ACTIVATION_APPROVED",
        occurredAt: activation.approvedAt,
        summary: `${channelLabel} activation approved${activation.approvedBy ? ` by ${activation.approvedBy}` : ""}`,
      });
    }
    if (activation.sentAt) {
      entries.push({
        type: "ACTIVATION_SENT",
        occurredAt: activation.sentAt,
        summary: `${channelLabel} activation marked sent`,
      });
    }
  }

  for (const outcome of outcomes) {
    const label = getOutcomeEventTypeDefinition(outcome.type)?.label ?? outcome.type;
    entries.push({
      type: "OUTCOME",
      occurredAt: outcome.occurredAt,
      summary: `Outcome recorded: ${label}`,
    });
  }

  return entries.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}
