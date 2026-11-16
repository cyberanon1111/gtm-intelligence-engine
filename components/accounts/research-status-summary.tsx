import { Badge } from "@/components/ui/badge";

interface RunErrorEntry {
  step: string;
  message: string;
}

interface LatestRun {
  status: string;
  completedAt: Date | null;
  startedAt: Date;
  sourcesFound: number;
  factsExtracted: number;
  signalsDetected: number;
  scoreBefore: number | null;
  scoreAfter: number | null;
  errors: unknown;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  COMPLETED: "default",
  PARTIAL: "secondary",
  PENDING: "secondary",
  FAILED: "destructive",
  SKIPPED: "outline",
};

// The always-visible status block the spec asks for on the account page —
// distinct from the full scrollable Research History list below it, this is
// just "what's the current state, right now, and why" at a glance.
export function ResearchStatusSummary({ latestRun }: { latestRun: LatestRun | null }) {
  if (!latestRun) {
    return (
      <p className="text-sm text-muted-foreground">
        Never researched. Click &ldquo;Research Account&rdquo; to run the pipeline.
      </p>
    );
  }

  const errors = Array.isArray(latestRun.errors) ? (latestRun.errors as RunErrorEntry[]) : [];
  const timestamp = latestRun.completedAt ?? latestRun.startedAt;
  const scoreKnown = latestRun.scoreBefore !== null && latestRun.scoreAfter !== null;

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Last researched</span>
        <span>{timestamp.toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Research status</span>
        <Badge variant={STATUS_VARIANT[latestRun.status] ?? "outline"}>{latestRun.status}</Badge>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Sources found</span>
        <span>{latestRun.sourcesFound}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Facts extracted</span>
        <span>{latestRun.factsExtracted}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Signals detected</span>
        <span>{latestRun.signalsDetected}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Score before → after</span>
        <span>{scoreKnown ? `${latestRun.scoreBefore} → ${latestRun.scoreAfter}` : "—"}</span>
      </div>
      {(latestRun.status === "FAILED" || latestRun.status === "PARTIAL" || latestRun.status === "SKIPPED") &&
        errors.length > 0 && (
          <div className="mt-1 border-t pt-2">
            <p className="text-xs font-medium text-muted-foreground">Why:</p>
            <ul
              className={`list-inside list-disc text-xs ${latestRun.status === "SKIPPED" ? "text-muted-foreground" : "text-destructive"}`}
            >
              {errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          </div>
        )}
    </div>
  );
}
