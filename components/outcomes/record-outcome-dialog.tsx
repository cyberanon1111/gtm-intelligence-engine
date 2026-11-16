"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { OUTCOME_EVENT_TYPES, getOutcomeEventTypeDefinition, type OutcomeEventTypeKey } from "@/config/meridian/outcomeTypes";
import { recordOutcomeEventAction } from "@/app/(app)/outcomes/actions";

const NONE = "__none__";

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Used two ways: from an Activation review page (activationId fixed, so the
// event is directly attributable to that draft) and from the account page
// (no activationId — an account-level outcome, e.g. a deal closing weeks
// after several activations, that isn't tied to one specific message).
export function RecordOutcomeDialog({
  accountId,
  activationId,
  contacts,
}: {
  accountId: string;
  activationId?: string;
  contacts?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<OutcomeEventTypeKey>("REPLIED");
  const [occurredAt, setOccurredAt] = useState(() => toLocalDatetimeInputValue(new Date()));
  const [contactId, setContactId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    const result = await recordOutcomeEventAction({
      accountId,
      activationId: activationId ?? null,
      contactId: contactId || null,
      type,
      occurredAt: new Date(occurredAt).toISOString(),
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    setOpen(false);
    setNotes("");
    toast.success("Outcome recorded");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <PlusCircle className="size-4" /> Record Outcome
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Outcome</DialogTitle>
          <DialogDescription>
            Manually record what actually happened. This is append-only — recording a new event never
            replaces or removes a previous one, and you can record several against the same activation.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as OutcomeEventTypeKey)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: OutcomeEventTypeKey) => getOutcomeEventTypeDefinition(v)?.label ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_EVENT_TYPES.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Date / time</Label>
            <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
          </div>

          {contacts && contacts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Contact (optional)</Label>
              <Select value={contactId || NONE} onValueChange={(v) => setContactId(v === NONE || !v ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None">
                    {(v: string) => {
                      if (v === NONE || !v) return "None";
                      return contacts.find((c) => c.id === v)?.name ?? "None";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Recording…" : "Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
