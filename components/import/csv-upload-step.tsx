"use client";

import { useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function CsvUploadStep({
  onParsed,
}: {
  onParsed: (result: { headers: string[]; rows: Record<string, string>[]; fileName: string }) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Please upload a .csv file.");
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields ?? [];
        if (headers.length === 0 || result.data.length === 0) {
          toast.error("This CSV appears to be empty.");
          return;
        }
        if (result.errors.length > 0) {
          toast.warning(
            `Parsed with ${result.errors.length} row-level warning(s) — check the preview carefully.`,
          );
        }
        onParsed({ headers, rows: result.data, fileName: file.name });
      },
      error: (error) => {
        toast.error(`Could not parse this CSV: ${error.message}`);
      },
    });
  }

  return (
    <Card
      className={`border-dashed ${dragOver ? "border-primary bg-secondary/40" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
    >
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <UploadCloud className="size-8 text-muted-foreground" />
        <div>
          <p className="font-medium">Drop a CSV file here, or choose one</p>
          <p className="text-sm text-muted-foreground">
            Comma-separated values, with a header row. Quoted fields and missing values are handled.
          </p>
        </div>
        <Button variant="outline" render={<label className="cursor-pointer" />}>
          Choose file
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </Button>
      </CardContent>
    </Card>
  );
}
