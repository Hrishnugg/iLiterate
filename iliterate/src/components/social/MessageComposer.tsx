"use client";

import { useState } from "react";
import { SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";

interface MessageComposerProps {
  disabled?: boolean;
  isSending?: boolean;
  onSend: (body: string) => Promise<void> | void;
}

export function MessageComposer({
  disabled = false,
  isSending = false,
  onSend,
}: MessageComposerProps) {
  const [body, setBody] = useState("");

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed || disabled || isSending) {
      return;
    }

    await onSend(trimmed);
    setBody("");
  };

  return (
    <div className="border-t px-5 py-4">
      <div className="rounded-2xl border bg-muted/20 p-3 shadow-sm">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Write a message to your study partner..."
          disabled={disabled || isSending}
          rows={3}
          className="min-h-24 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            Press Enter to send. Shift + Enter adds a new line.
          </p>
          <Button
            onClick={() => void submit()}
            disabled={disabled || isSending || !body.trim()}
            size="sm"
          >
            <SendHorizontal className="size-4" />
            {isSending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
