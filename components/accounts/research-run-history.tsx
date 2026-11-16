import { Badge } from "@/components/ui/badge";

interface RunErrorEntry {
  step: string;
  message: string;
}

interface RunRow {
  id: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
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

export function ResearchRunHistory({ runs }: { runs: RunRow[] }) {
  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No research has been run yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {runs.map((run) => {
        const errors = Array.isArray(run.errors) ? (run.errors as RunErrorEntry[]) : [];
        const scoreChanged =
          run.scoreBefore !== null && run.scoreAfter !== null && run.scoreBefore !== run.scoreAfter;
        return (
          <div key={run.id} className="flex flex-col gap-1.5 border-b pb-3 text-sm last:border-0 last:pb-0">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {(run.completedAt ?? run.startedAt).toLocaleString()}
              </span>
              <Badge variant={STATUS_VARIANT[run.status] ?? "outline"}>{run.status}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {run.sourcesFound} source(s) found · {run.factsExtracted} fact(s) extracted ·{" "}
              {run.signalsDetected} signal(s) detected
              {scoreChanged && (
                <>
                  {" "}
                  · score {run.scoreBefore} → {run.scoreAfter}
                </>
              )}
            </div>
            {errors.length > 0 && (
              <ul
                className={`mt-1 list-inside list-disc text-xs ${run.status === "SKIPPED" ? "text-muted-foreground" : "text-destructive"}`}
              >
                {errors.map((e, i) => (
                  <li key={i}>
                    {e.step}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
