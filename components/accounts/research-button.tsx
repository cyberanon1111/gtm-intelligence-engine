"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { researchAccountAction } from "@/app/(app)/accounts/research-actions";

export function ResearchButton({ accountId, hasResearch }: { accountId: string; hasResearch: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    // "Refresh Research" (hasResearch=true) is the explicit bypass of the
    // freshness window; "Research Account" has nothing to be fresh against.
    const result = await researchAccountAction(accountId, hasResearch);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      router.refresh();
      return;
    }

    const { status, signalsDetected, scoreBefore, scoreAfter } = result.data;

    if (status === "SKIPPED") {
      toast.info("Research is still fresh — no new external call was made.");
      router.refresh();
      return;
    }

    const scoreChanged = scoreBefore !== null && scoreAfter !== null && scoreBefore !== scoreAfter;
    const parts = [
      signalsDetected > 0 ? `${signalsDetected} new signal(s) detected` : "no new signals detected",
      scoreChanged ? `score ${scoreBefore} -> ${scoreAfter}` : null,
    ].filter(Boolean);
    const message = `Research ${status === "PARTIAL" ? "partially completed" : "complete"} — ${parts.join(", ")}`;

    if (status === "PARTIAL") {
      toast.warning(message);
    } else {
      toast.success(message);
    }
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
      <Sparkles className={`size-4 ${pending ? "animate-pulse" : ""}`} />
      {pending ? "Researching…" : hasResearch ? "Refresh Research" : "Research Account"}
    </Button>
  );
}
