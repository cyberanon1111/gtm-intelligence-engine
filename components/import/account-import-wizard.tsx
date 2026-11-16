"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CsvUploadStep } from "@/components/import/csv-upload-step";
import { CsvMappingStep } from "@/components/import/csv-mapping-step";
import { RowStatusBadge } from "@/components/import/row-status-badge";
import { ACCOUNT_CSV_FIELDS } from "@/lib/csv/fields";
import { guessColumnMapping, applyColumnMapping } from "@/lib/csv/mapping";
import { validateAccountRows, type AccountRowResult } from "@/lib/csv/accountImport";
import {
  getAccountImportContextAction,
  importAccountsRowsAction,
} from "@/app/(app)/import/actions";

type Step = "upload" | "map" | "preview";

export function AccountImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [mappedRows, setMappedRows] = useState<Record<string, string>[]>([]);
  const [results, setResults] = useState<AccountRowResult[]>([]);
  const [included, setIncluded] = useState<Record<number, boolean>>({});
  const [existingCompanyNames, setExistingCompanyNames] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<{ imported: number; rejected: number } | null>(null);

  useEffect(() => {
    getAccountImportContextAction().then((ctx) =>
      setExistingCompanyNames(new Set(ctx.existingCompanyNames)),
    );
  }, []);

  function handleParsed(result: { headers: string[]; rows: Record<string, string>[] }) {
    setHeaders(result.headers);
    setRawRows(result.rows);
    setMapping(guessColumnMapping(result.headers, ACCOUNT_CSV_FIELDS));
    setStep("map");
  }

  function confirmMapping() {
    const mapped = applyColumnMapping(rawRows, mapping);
    const validated = validateAccountRows(mapped, existingCompanyNames);
    const initialIncluded: Record<number, boolean> = {};
    for (const r of validated) initialIncluded[r.rowIndex] = r.status === "valid";
    setMappedRows(mapped);
    setResults(validated);
    setIncluded(initialIncluded);
    setSummary(null);
    setStep("preview");
  }

  function updateCell(rowIndex: number, field: string, value: string) {
    const nextMapped = mappedRows.map((row, i) =>
      i === rowIndex ? { ...row, [field]: value } : row,
    );
    const nextResults = validateAccountRows(nextMapped, existingCompanyNames);
    setMappedRows(nextMapped);
    setResults(nextResults);
    setIncluded((prev) => {
      const next = { ...prev };
      if (nextResults[rowIndex].status === "invalid") next[rowIndex] = false;
      return next;
    });
  }

  const counts = {
    total: results.length,
    valid: results.filter((r) => r.status === "valid").length,
    duplicate: results.filter((r) => r.status === "duplicate").length,
    invalid: results.filter((r) => r.status === "invalid").length,
  };
  const includedCount = Object.values(included).filter(Boolean).length;
  const mappedFieldKeys = [...new Set(Object.values(mapping).filter((v): v is string => !!v))];

  async function handleImport() {
    const rowsToImport = results
      .filter((r) => included[r.rowIndex] && r.data)
      .map((r) => r.data);
    if (rowsToImport.length === 0) {
      toast.error("Select at least one valid row to import.");
      return;
    }
    setImporting(true);
    const result = await importAccountsRowsAction(rowsToImport);
    setImporting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setSummary(result.data);
    toast.success(`Imported ${result.data.imported} account(s).`);
    router.refresh();
  }

  if (step === "upload") {
    return <CsvUploadStep onParsed={handleParsed} />;
  }

  if (step === "map") {
    return (
      <CsvMappingStep
        headers={headers}
        sampleRow={rawRows[0]}
        fields={ACCOUNT_CSV_FIELDS}
        mapping={mapping}
        onChange={(header, key) => setMapping((prev) => ({ ...prev, [header]: key }))}
        onBack={() => setStep("upload")}
        onConfirm={confirmMapping}
      />
    );
  }

  if (summary) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-md border bg-card p-6">
        <p className="text-sm">
          Imported <strong>{summary.imported}</strong> account(s).
          {summary.rejected > 0 && ` ${summary.rejected} row(s) were rejected.`}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => router.push("/accounts")}>Go to Accounts</Button>
          <Button
            variant="outline"
            onClick={() => {
              setStep("upload");
              setSummary(null);
            }}
          >
            Import another file
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <SummaryBadge label="Total" value={counts.total} />
        <SummaryBadge label="Valid" value={counts.valid} tone="default" />
        <SummaryBadge label="Duplicate" value={counts.duplicate} tone="secondary" />
        <SummaryBadge label="Invalid" value={counts.invalid} tone="destructive" />
        <span className="ml-auto text-muted-foreground">{includedCount} selected to import</span>
      </div>

      <div className="max-h-[520px] overflow-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Status</TableHead>
              {mappedFieldKeys.map((key) => (
                <TableHead key={key}>
                  {ACCOUNT_CSV_FIELDS.find((f) => f.key === key)?.label ?? key}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((row) => (
              <TableRow key={row.rowIndex} className={row.status === "invalid" ? "bg-destructive/5" : ""}>
                <TableCell>
                  <Checkbox
                    checked={!!included[row.rowIndex]}
                    disabled={row.status === "invalid"}
                    onCheckedChange={(checked) =>
                      setIncluded((prev) => ({ ...prev, [row.rowIndex]: checked === true }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <RowStatusBadge status={row.status} />
                </TableCell>
                {mappedFieldKeys.map((key) => (
                  <TableCell key={key} className="min-w-[160px]">
                    <Input
                      value={row.values[key] ?? ""}
                      onChange={(e) => updateCell(row.rowIndex, key, e.target.value)}
                      aria-invalid={!!row.errors[key]}
                      className="h-8"
                    />
                    {row.errors[key] && (
                      <p className="mt-1 text-xs text-destructive">{row.errors[key]}</p>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep("map")}>
          Back
        </Button>
        <Button onClick={handleImport} disabled={importing || includedCount === 0}>
          {importing ? "Importing…" : `Import ${includedCount} account(s)`}
        </Button>
      </div>
    </div>
  );
}

function SummaryBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "default" | "secondary" | "destructive";
}) {
  const toneClass =
    tone === "default"
      ? "text-primary"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "secondary"
          ? "text-muted-foreground"
          : "";
  return (
    <span className={`rounded-md border px-2 py-1 ${toneClass}`}>
      {label}: {value}
    </span>
  );
}
