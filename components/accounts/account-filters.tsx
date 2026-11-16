"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_STATUS_VALUES } from "@/lib/validation/account";
import { ACCOUNT_STATUS_LABELS } from "@/lib/labels";

const ALL = "__all__";

export function AccountFilters({
  countries,
  companyTypes,
}: {
  countries: string[];
  companyTypes: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "" || value === ALL) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/accounts?${params.toString()}`);
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    updateParam("q", q);
  }

  const hasActiveFilters =
    searchParams.get("q") ||
    searchParams.get("country") ||
    searchParams.get("companyType") ||
    searchParams.get("status") ||
    searchParams.get("fleetSizeMin") ||
    searchParams.get("fleetSizeMax") ||
    searchParams.get("showArchived");

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-card p-4">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by company name, website, or country…"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Country">
          <Select
            value={searchParams.get("country") ?? ALL}
            onValueChange={(v) => updateParam("country", v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All countries">{(v: string) => (v === ALL ? "All countries" : v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All countries</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Company type">
          <Select
            value={searchParams.get("companyType") ?? ALL}
            onValueChange={(v) => updateParam("companyType", v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All types">{(v: string) => (v === ALL ? "All types" : v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {companyTypes.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Status">
          <Select
            value={searchParams.get("status") ?? ALL}
            onValueChange={(v) => updateParam("status", v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses">
                {(v: string) =>
                  v === ALL ? "All statuses" : (ACCOUNT_STATUS_LABELS[v as keyof typeof ACCOUNT_STATUS_LABELS] ?? v)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {ACCOUNT_STATUS_VALUES.map((status) => (
                <SelectItem key={status} value={status}>
                  {ACCOUNT_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Min fleet size">
          <Input
            type="number"
            min={0}
            className="w-28"
            defaultValue={searchParams.get("fleetSizeMin") ?? ""}
            onBlur={(e) => updateParam("fleetSizeMin", e.target.value)}
          />
        </FilterField>

        <FilterField label="Max fleet size">
          <Input
            type="number"
            min={0}
            className="w-28"
            defaultValue={searchParams.get("fleetSizeMax") ?? ""}
            onBlur={(e) => updateParam("fleetSizeMax", e.target.value)}
          />
        </FilterField>

        <FilterField label="Archived">
          <Select
            value={searchParams.get("showArchived") === "true" ? "true" : "false"}
            onValueChange={(v) => updateParam("showArchived", v === "true" ? "true" : null)}
          >
            <SelectTrigger className="w-36">
              <SelectValue>{(v: string) => (v === "true" ? "Archived only" : "Active only")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">Active only</SelectItem>
              <SelectItem value="true">Archived only</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={() => router.push("/accounts")}>
            <X className="size-4" /> Clear filters
          </Button>
        ) : null}
      </div>
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
