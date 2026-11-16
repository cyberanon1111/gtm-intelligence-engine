"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  ACTIVATION_CHANNELS,
  getActivationChannelDefinition,
  type ActivationChannelKey,
} from "@/config/meridian/activationChannels";
import { generateActivationAction } from "@/app/(app)/activations/actions";

const NONE = "__none__";

export function GenerateActivationDialog({
  accountId,
  contacts,
}: {
  accountId: string;
  contacts: { id: string; name: string; title: string | null }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<ActivationChannelKey>("LINKEDIN");
  const [contactId, setContactId] = useState("");
  const [objective, setObjective] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const channelDef = ACTIVATION_CHANNELS.find((c) => c.key === channel)!;

  async function handleSubmit() {
    if (!objective.trim()) {
      toast.error("Objective is required.");
      return;
    }
    if (channelDef.requiresContact && !contactId) {
      toast.error(`${channelDef.label} requires a contact.`);
      return;
    }

    setSubmitting(true);
    const result = await generateActivationAction({
      accountId,
      contactId: contactId || null,
      channel,
      objective: objective.trim(),
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    setOpen(false);
    toast.success("Draft generated");
    router.push(`/accounts/${accountId}/activations/${result.data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Sparkles className="size-4" /> Generate Activation
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Activation</DialogTitle>
          <DialogDescription>
            Drafts content grounded in this account&apos;s score, research, and evidence — always a draft
            requiring human review before anything is approved or sent.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as ActivationChannelKey)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: ActivationChannelKey) => getActivationChannelDefinition(v)?.label ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ACTIVATION_CHANNELS.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{channelDef.description}</p>
          </div>

          {channelDef.kind === "outbound" && (
            <div className="flex flex-col gap-1.5">
              <Label>
                Contact{channelDef.requiresContact && <span className="text-destructive"> *</span>}
              </Label>
              <Select value={contactId || NONE} onValueChange={(v) => setContactId(v === NONE || !v ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a contact">
                    {(v: string) => {
                      if (v === NONE || !v) return "None";
                      const c = contacts.find((contact) => contact.id === v);
                      return c ? `${c.name}${c.title ? ` — ${c.title}` : ""}` : "Select a contact";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.title ? ` — ${c.title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {contacts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  This account has no contacts yet — add one first.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>
              Objective <span className="text-destructive">*</span>
            </Label>
            <Input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Introduce MoorSense M4 given the recent SIRE 2.0 signal"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
