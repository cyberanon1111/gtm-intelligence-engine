"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recalculateScoreAction } from "@/app/(app)/accounts/actions";

export function RecalculateScoreButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const result = await recalculateScoreAction(accountId);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Score recalculated");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
      <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} /> Recalculate Score
    </Button>
  );
}
