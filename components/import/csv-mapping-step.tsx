"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CsvFieldDef } from "@/lib/csv/fields";

const IGNORE = "__ignore__";

export function CsvMappingStep({
  headers,
  sampleRow,
  fields,
  mapping,
  onChange,
  onBack,
  onConfirm,
}: {
  headers: string[];
  sampleRow?: Record<string, string>;
  fields: CsvFieldDef[];
  mapping: Record<string, string | null>;
  onChange: (header: string, fieldKey: string | null) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const mappedKeys = new Set(Object.values(mapping).filter((v): v is string => v !== null));
  const missingRequired = fields.filter((f) => f.required && !mappedKeys.has(f.key));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CSV Column</TableHead>
              <TableHead>Sample Value</TableHead>
              <TableHead>Maps To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {headers.map((header) => (
              <TableRow key={header}>
                <TableCell className="font-medium">{header}</TableCell>
                <TableCell className="max-w-[240px] truncate text-muted-foreground">
                  {sampleRow?.[header] || "—"}
                </TableCell>
                <TableCell>
                  <Select
                    value={mapping[header] ?? IGNORE}
                    onValueChange={(v) => onChange(header, v === IGNORE ? null : v)}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue>
                        {(v: string) => {
                          if (v === IGNORE) return "Ignore this column";
                          const field = fields.find((f) => f.key === v);
                          return field ? `${field.label}${field.required ? " *" : ""}` : "Ignore this column";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={IGNORE}>Ignore this column</SelectItem>
                      {fields.map((field) => (
                        <SelectItem key={field.key} value={field.key}>
                          {field.label}
                          {field.required ? " *" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {missingRequired.length > 0 && (
        <p className="text-sm text-destructive">
          Map a column to: {missingRequired.map((f) => f.label).join(", ")} before continuing.
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onConfirm} disabled={missingRequired.length > 0}>
          Continue to preview
        </Button>
      </div>
    </div>
  );
}
