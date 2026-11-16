"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { updateActivationContentAction } from "@/app/(app)/activations/actions";

const FIELD_LABELS: Record<string, Record<string, string>> = {
  LINKEDIN: { angle: "Angle", message: "Message", cta: "Call to Action" },
  EMAIL: { angle: "Subject / Angle", message: "Body", cta: "Call to Action" },
  SALES_BRIEF: {
    whyNow: "Why Now",
    relevantSignals: "Relevant Signals",
    relevantProblem: "Relevant Problem",
    potentialStakeholder: "Potential Stakeholder",
    relevantProduct: "Relevant Product",
    suggestedOpening: "Suggested Opening",
  },
  CONTENT_RECOMMENDATION: {
    targetProblem: "Target Problem",
    targetPersona: "Target Persona",
    contentAngle: "Content Angle",
    suggestedFormat: "Suggested Format",
    supportingEvidenceSummary: "Supporting Evidence Summary",
    suggestedCta: "Suggested CTA",
  },
};

const ARRAY_FIELDS = new Set(["relevantSignals"]);

function fieldLabel(channel: string, key: string): string {
  return FIELD_LABELS[channel]?.[key] ?? key;
}

export function DraftContentView({ channel, content }: { channel: string; content: Record<string, unknown> }) {
  const labels = FIELD_LABELS[channel] ?? {};
  const keys = Object.keys(labels).length ? Object.keys(labels) : Object.keys(content);

  return (
    <div className="flex flex-col gap-3 text-sm">
      {keys.map((key) => {
        const value = content[key];
        return (
          <div key={key}>
            <div className="font-medium">{fieldLabel(channel, key)}</div>
            {Array.isArray(value) ? (
              <ul className="list-inside list-disc text-muted-foreground">
                {value.map((item, i) => (
                  <li key={i}>{String(item)}</li>
                ))}
              </ul>
            ) : (
              <p className="whitespace-pre-wrap text-muted-foreground">{String(value ?? "—")}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DraftContentEditor({
  activationId,
  channel,
  content,
  onSaved,
}: {
  activationId: string;
  channel: string;
  content: Record<string, unknown>;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const labels = FIELD_LABELS[channel] ?? {};
  const keys = Object.keys(labels).length ? Object.keys(labels) : Object.keys(content);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const key of keys) {
      const value = content[key];
      initial[key] = Array.isArray(value) ? value.join("\n") : String(value ?? "");
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const nextContent: Record<string, unknown> = {};
    for (const key of keys) {
      nextContent[key] = ARRAY_FIELDS.has(key)
        ? values[key]
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
        : values[key];
    }

    const result = await updateActivationContentAction(activationId, nextContent);
    setSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Draft saved");
    router.refresh();
    onSaved?.();
  }

  return (
    <div className="flex flex-col gap-3">
      {keys.map((key) => (
        <div key={key} className="flex flex-col gap-1.5">
          <Label>{fieldLabel(channel, key)}</Label>
          <Textarea
            value={values[key]}
            onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
            rows={ARRAY_FIELDS.has(key) ? 3 : key === "message" ? 6 : 2}
          />
        </div>
      ))}
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
