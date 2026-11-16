"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  regenerateActivationAction,
  submitActivationForReviewAction,
  approveActivationAction,
  rejectActivationAction,
  markActivationSentAction,
  cancelActivationAction,
} from "@/app/(app)/activations/actions";

type ActionResult = { success: true; data?: unknown } | { success: false; error: string };

function useActivationAction() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function run(name: string, action: () => Promise<ActionResult>, successMessage: string) {
    setPending(name);
    const result = await action();
    setPending(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(successMessage);
    router.refresh();
    return result;
  }

  return { pending, run };
}

export function RegenerateButton({ activationId, accountId }: { activationId: string; accountId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const result = await regenerateActivationAction(activationId);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("New version generated");
    router.push(`/accounts/${accountId}/activations/${result.data.id}`);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
      <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} /> Regenerate
    </Button>
  );
}

export function SubmitForReviewButton({ activationId }: { activationId: string }) {
  const { pending, run } = useActivationAction();
  return (
    <Button
      size="sm"
      disabled={pending !== null}
      onClick={() => run("submit", () => submitActivationForReviewAction(activationId), "Submitted for review")}
    >
      {pending === "submit" ? "Submitting…" : "Submit for Review"}
    </Button>
  );
}

export function ApproveButton({ activationId }: { activationId: string }) {
  const { pending, run } = useActivationAction();
  return (
    <Button
      size="sm"
      disabled={pending !== null}
      onClick={() => run("approve", () => approveActivationAction(activationId), "Approved")}
    >
      {pending === "approve" ? "Approving…" : "Approve"}
    </Button>
  );
}

export function RejectButton({ activationId }: { activationId: string }) {
  const { pending, run } = useActivationAction();
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    const result = await run("reject", () => rejectActivationAction(activationId), "Rejected");
    if (result?.success) setOpen(false);
  }

  return (
    <>
      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        Reject
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this draft?</DialogTitle>
            <DialogDescription>
              A rejected draft can never be approved or sent. This cannot be undone — but you can regenerate
              a fresh draft afterward.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending !== null}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={pending !== null}>
              {pending === "reject" ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MarkSentButton({ activationId }: { activationId: string }) {
  const { pending, run } = useActivationAction();
  return (
    <Button
      size="sm"
      disabled={pending !== null}
      onClick={() => run("send", () => markActivationSentAction(activationId), "Marked as sent")}
    >
      {pending === "send" ? "Marking…" : "Mark as Sent"}
    </Button>
  );
}

export function CancelButton({ activationId }: { activationId: string }) {
  const { pending, run } = useActivationAction();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending !== null}
      onClick={() => run("cancel", () => cancelActivationAction(activationId), "Cancelled")}
    >
      {pending === "cancel" ? "Cancelling…" : "Cancel"}
    </Button>
  );
}
