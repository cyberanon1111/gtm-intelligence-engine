"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { createContactAction, updateContactAction } from "@/app/(app)/accounts/actions";
import { SENIORITY_SUGGESTIONS } from "@/lib/validation/contact";

const NONE = "__none__";

interface ContactFormValues {
  name: string;
  title: string;
  department: string;
  linkedinUrl: string;
  email: string;
  personaId: string;
  seniority: string;
  influenceScore: string;
}

const EMPTY_VALUES: ContactFormValues = {
  name: "",
  title: "",
  department: "",
  linkedinUrl: "",
  email: "",
  personaId: "",
  seniority: "",
  influenceScore: "",
};

export function ContactFormDialog({
  accountId,
  personas,
  trigger,
  contact,
}: {
  accountId: string;
  personas: { id: string; name: string }[];
  trigger: ReactNode;
  contact?: {
    id: string;
    name: string;
    title: string | null;
    department: string | null;
    linkedinUrl: string | null;
    email: string | null;
    personaId: string | null;
    seniority: string | null;
    influenceScore: number | null;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ContactFormValues>(
    contact
      ? {
          name: contact.name,
          title: contact.title ?? "",
          department: contact.department ?? "",
          linkedinUrl: contact.linkedinUrl ?? "",
          email: contact.email ?? "",
          personaId: contact.personaId ?? "",
          seniority: contact.seniority ?? "",
          influenceScore: contact.influenceScore?.toString() ?? "",
        }
      : EMPTY_VALUES,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFieldErrors({});

    const payload = { ...values };
    const result = contact
      ? await updateContactAction(contact.id, accountId, payload)
      : await createContactAction(accountId, payload);

    setSubmitting(false);

    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      toast.error(result.error);
      return;
    }

    toast.success(contact ? "Contact updated" : "Contact added");
    setOpen(false);
    if (!contact) setValues(EMPTY_VALUES);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "Add contact"}</DialogTitle>
          <DialogDescription>
            {contact ? "Update this contact's details." : "Add a contact to this account."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Name" error={fieldErrors.name} required>
            <Input value={values.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Title" error={fieldErrors.title}>
              <Input value={values.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Department" error={fieldErrors.department}>
              <Input
                value={values.department}
                onChange={(e) => set("department", e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email" error={fieldErrors.email}>
              <Input value={values.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="LinkedIn URL" error={fieldErrors.linkedinUrl}>
              <Input
                value={values.linkedinUrl}
                onChange={(e) => set("linkedinUrl", e.target.value)}
                placeholder="linkedin.com/in/…"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Persona" error={fieldErrors.personaId}>
              <Select
                value={values.personaId || NONE}
                onValueChange={(v) => set("personaId", v === NONE || !v ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned">
                    {(v: string) => {
                      if (v === NONE || !v) return "Unassigned";
                      return personas.find((p) => p.id === v)?.name ?? "Unassigned";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unassigned</SelectItem>
                  {personas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Seniority" error={fieldErrors.seniority}>
              <Select
                value={values.seniority || NONE}
                onValueChange={(v) => set("seniority", v === NONE || !v ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unspecified">
                    {(v: string) => (v === NONE || !v ? "Unspecified" : v.replace(/_/g, " "))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unspecified</SelectItem>
                  {SENIORITY_SUGGESTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field
            label="Influence score"
            error={fieldErrors.influenceScore}
            hint="0-100, how much this person influences the buying decision"
          >
            <Input
              type="number"
              min={0}
              max={100}
              value={values.influenceScore}
              onChange={(e) => set("influenceScore", e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : contact ? "Save changes" : "Add contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
