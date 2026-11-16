"use client";

import { useState, type FormEvent } from "react";
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
import { createAccountAction, updateAccountAction } from "@/app/(app)/accounts/actions";
import { ACCOUNT_STATUS_VALUES } from "@/lib/validation/account";
import { ACCOUNT_STATUS_LABELS } from "@/lib/labels";

export interface AccountFormValues {
  companyName: string;
  website: string;
  country: string;
  companyType: string;
  fleetSize: string;
  vesselTypes: string;
  regions: string;
  status: string;
}

const EMPTY_VALUES: AccountFormValues = {
  companyName: "",
  website: "",
  country: "",
  companyType: "",
  fleetSize: "",
  vesselTypes: "",
  regions: "",
  status: "NEW",
};

export function AccountForm({
  accountId,
  defaultValues,
}: {
  accountId?: string;
  defaultValues?: Partial<AccountFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<AccountFormValues>({ ...EMPTY_VALUES, ...defaultValues });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof AccountFormValues>(key: K, value: AccountFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFieldErrors({});

    const payload = {
      companyName: values.companyName,
      website: values.website,
      country: values.country,
      companyType: values.companyType,
      fleetSize: values.fleetSize,
      vesselTypes: values.vesselTypes,
      regions: values.regions,
      status: values.status,
    };

    const result = accountId
      ? await updateAccountAction(accountId, payload)
      : await createAccountAction(payload);

    setSubmitting(false);

    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      toast.error(result.error);
      return;
    }

    toast.success(accountId ? "Account updated" : "Account created");
    router.push(`/accounts/${result.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-2xl">
      <Field label="Company name" error={fieldErrors.companyName} required>
        <Input
          value={values.companyName}
          onChange={(e) => set("companyName", e.target.value)}
          placeholder="OceanTrans Ship Management"
          aria-invalid={!!fieldErrors.companyName}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Website" error={fieldErrors.website}>
          <Input
            value={values.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="company.com"
            aria-invalid={!!fieldErrors.website}
          />
        </Field>
        <Field label="Country" error={fieldErrors.country}>
          <Input
            value={values.country}
            onChange={(e) => set("country", e.target.value)}
            placeholder="Singapore"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Company type" error={fieldErrors.companyType}>
          <Input
            value={values.companyType}
            onChange={(e) => set("companyType", e.target.value)}
            placeholder="Ship Manager"
          />
        </Field>
        <Field label="Fleet size" error={fieldErrors.fleetSize}>
          <Input
            type="number"
            min={0}
            value={values.fleetSize}
            onChange={(e) => set("fleetSize", e.target.value)}
            placeholder="42"
            aria-invalid={!!fieldErrors.fleetSize}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label="Vessel types"
          error={fieldErrors.vesselTypes}
          hint="Comma-separated, e.g. Tanker, Bulk Carrier"
        >
          <Input
            value={values.vesselTypes}
            onChange={(e) => set("vesselTypes", e.target.value)}
            placeholder="Tanker, Bulk Carrier"
          />
        </Field>
        <Field label="Regions" error={fieldErrors.regions} hint="Comma-separated">
          <Input
            value={values.regions}
            onChange={(e) => set("regions", e.target.value)}
            placeholder="Asia Pacific, Middle East"
          />
        </Field>
      </div>

      <Field label="Status" error={fieldErrors.status}>
        <Select value={values.status} onValueChange={(v) => set("status", v ?? "NEW")}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: keyof typeof ACCOUNT_STATUS_LABELS) => ACCOUNT_STATUS_LABELS[v] ?? v}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_STATUS_VALUES.map((status) => (
              <SelectItem key={status} value={status}>
                {ACCOUNT_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : accountId ? "Save changes" : "Create account"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
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
  children: React.ReactNode;
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
