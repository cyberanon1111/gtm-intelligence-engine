"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OUTCOME_EVENT_TYPES, getOutcomeEventTypeDefinition } from "@/config/meridian/outcomeTypes";
import { ACTIVATION_CHANNELS, getActivationChannelDefinition } from "@/config/meridian/activationChannels";

const ALL = "__all__";

export function OutcomeFilters({
  accounts,
  personas,
  products,
}: {
  accounts: { id: string; companyName: string }[];
  personas: string[];
  products: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "" || value === ALL) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/outcomes?${params.toString()}`);
  }

  const hasActiveFilters =
    searchParams.get("type") ||
    searchParams.get("channel") ||
    searchParams.get("accountId") ||
    searchParams.get("persona") ||
    searchParams.get("product") ||
    searchParams.get("from") ||
    searchParams.get("to");

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-4">
      <FilterField label="Type">
        <Select value={searchParams.get("type") ?? ALL} onValueChange={(v) => updateParam("type", v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All types">
              {(v: string) => (v === ALL ? "All types" : (getOutcomeEventTypeDefinition(v)?.label ?? v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {OUTCOME_EVENT_TYPES.map((t) => (
              <SelectItem key={t.key} value={t.key}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Channel">
        <Select value={searchParams.get("channel") ?? ALL} onValueChange={(v) => updateParam("channel", v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All channels">
              {(v: string) => (v === ALL ? "All channels" : (getActivationChannelDefinition(v)?.label ?? v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All channels</SelectItem>
            {ACTIVATION_CHANNELS.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Account">
        <Select value={searchParams.get("accountId") ?? ALL} onValueChange={(v) => updateParam("accountId", v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All accounts">
              {(v: string) => (v === ALL ? "All accounts" : (accounts.find((a) => a.id === v)?.companyName ?? "All accounts"))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.companyName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Persona">
        <Select value={searchParams.get("persona") ?? ALL} onValueChange={(v) => updateParam("persona", v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All personas">{(v: string) => (v === ALL ? "All personas" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All personas</SelectItem>
            {personas.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Product">
        <Select value={searchParams.get("product") ?? ALL} onValueChange={(v) => updateParam("product", v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All products">{(v: string) => (v === ALL ? "All products" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All products</SelectItem>
            {products.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="From">
        <Input
          type="date"
          className="w-36"
          defaultValue={searchParams.get("from") ?? ""}
          onBlur={(e) => updateParam("from", e.target.value)}
        />
      </FilterField>

      <FilterField label="To">
        <Input
          type="date"
          className="w-36"
          defaultValue={searchParams.get("to") ?? ""}
          onBlur={(e) => updateParam("to", e.target.value)}
        />
      </FilterField>

      {hasActiveFilters ? (
        <Button variant="ghost" size="sm" onClick={() => router.push("/outcomes")}>
          <X className="size-4" /> Clear filters
        </Button>
      ) : null}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
