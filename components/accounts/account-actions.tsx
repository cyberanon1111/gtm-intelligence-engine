"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setAccountArchivedAction, deleteAccountAction } from "@/app/(app)/accounts/actions";

export function ArchiveToggleButton({
  accountId,
  archived,
}: {
  accountId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    const result = await setAccountArchivedAction(accountId, !archived);
    setPending(false);
    if (!result.success) {
      toast.error("Something went wrong. Please try again.");
      return;
    }
    toast.success(archived ? "Account restored" : "Account archived");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} disabled={pending}>
      {archived ? (
        <>
          <ArchiveRestore className="size-4" /> Restore
        </>
      ) : (
        <>
          <Archive className="size-4" /> Archive
        </>
      )}
    </Button>
  );
}

export function DeleteAccountButton({
  accountId,
  companyName,
  redirectTo,
}: {
  accountId: string;
  companyName: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirmDelete() {
    setPending(true);
    const result = await deleteAccountAction(accountId);
    setPending(false);
    if (!result.success) {
      toast.error("Something went wrong. Please try again.");
      return;
    }
    setOpen(false);
    toast.success("Account deleted");
    if (redirectTo) {
      router.push(redirectTo);
    }
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {companyName}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the account and all of its contacts, signals,
              scores, insights, and activity history. This cannot be undone. If you
              just want to hide it from view, use Archive instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
