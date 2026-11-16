import type { WhatChangedResult } from "@/lib/research/whatChanged";

export function WhatChanged({ result }: { result: WhatChangedResult }) {
  if (!result.hasComparison) {
    return (
      <p className="text-sm text-muted-foreground">
        Not enough research history yet to show what changed — run research at least twice.
      </p>
    );
  }

  const { scoreChange, newSignals, newlyExpiredSignals, newResearchFacts, previousRunAt, latestRunAt } = result;
  const nothingChanged =
    (!scoreChange || scoreChange.delta === 0) &&
    newSignals.length === 0 &&
    newlyExpiredSignals.length === 0 &&
    newResearchFacts.length === 0;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Comparing {previousRunAt?.toLocaleDateString()} → {latestRunAt?.toLocaleDateString()}
      </p>

      {nothingChanged ? (
        <p className="text-muted-foreground">No meaningful changes since the previous research run.</p>
      ) : (
        <>
          {scoreChange && scoreChange.delta !== 0 && (
            <div>
              <span className="font-medium">Score change: </span>
              <span className={scoreChange.delta > 0 ? "text-primary" : "text-destructive"}>
                {scoreChange.before} → {scoreChange.after} ({scoreChange.delta > 0 ? "+" : ""}
                {scoreChange.delta})
              </span>
            </div>
          )}

          {newSignals.length > 0 && (
            <div>
              <div className="font-medium">New signals</div>
              <ul className="list-inside list-disc text-muted-foreground">
                {newSignals.map((s) => (
                  <li key={s.id}>
                    {s.title} ({s.type})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {newlyExpiredSignals.length > 0 && (
            <div>
              <div className="font-medium">Newly expired signals</div>
              <ul className="list-inside list-disc text-muted-foreground">
                {newlyExpiredSignals.map((s) => (
                  <li key={s.id}>{s.title}</li>
                ))}
              </ul>
            </div>
          )}

          {newResearchFacts.length > 0 && (
            <div>
              <div className="font-medium">New research findings</div>
              <ul className="list-inside list-disc text-muted-foreground">
                {newResearchFacts.map((fact, i) => (
                  <li key={i}>{fact}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
