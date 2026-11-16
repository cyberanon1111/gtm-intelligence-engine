import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

// Visually distinguishes AI-generated interpretation from verified/sourced
// data (Signals, Contacts, Company Attributes render with no such wrapper —
// their plain card styling IS the "this came from a deterministic system"
// signal). Never used around anything the deterministic system produced.
export function AiInterpretationPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-primary/30 bg-primary/[0.03] p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
        <Sparkles className="size-3.5" />
        AI interpretation — not independently verified
      </div>
      {children}
    </div>
  );
}
