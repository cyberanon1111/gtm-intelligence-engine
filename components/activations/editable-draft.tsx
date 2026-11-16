"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DraftContentView, DraftContentEditor } from "@/components/activations/draft-content";

export function EditableDraft({
  activationId,
  channel,
  content,
  editable,
}: {
  activationId: string;
  channel: string;
  content: Record<string, unknown>;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (!editable) {
    return <DraftContentView channel={channel} content={content} />;
  }

  return editing ? (
    <DraftContentEditor
      activationId={activationId}
      channel={channel}
      content={content}
      onSaved={() => setEditing(false)}
    />
  ) : (
    <div className="flex flex-col gap-3">
      <DraftContentView channel={channel} content={content} />
      <Button variant="outline" size="sm" className="self-start" onClick={() => setEditing(true)}>
        Edit
      </Button>
    </div>
  );
}
