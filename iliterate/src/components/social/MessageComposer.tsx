"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Paperclip,
  SendHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const MAX_ATTACHMENTS = 5;

export interface MessageComposerSubmitPayload {
  body: string;
  files: File[];
}

interface AttachmentDraft {
  id: string;
  file: File;
  kind: "image" | "pdf" | "docx";
  previewUrl: string | null;
}

interface MessageComposerProps {
  disabled?: boolean;
  isSending?: boolean;
  onSend: (payload: MessageComposerSubmitPayload) => Promise<void> | void;
}

function inferAttachmentKind(file: File): AttachmentDraft["kind"] | null {
  const mimeType = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }

  return null;
}

function attachmentLabel(kind: AttachmentDraft["kind"]) {
  switch (kind) {
    case "image":
      return "Image";
    case "pdf":
      return "PDF";
    case "docx":
      return "DOCX";
  }
}

export function MessageComposer({
  disabled = false,
  isSending = false,
  onSend,
}: MessageComposerProps) {
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSubmit = useMemo(
    () => body.trim().length > 0 || attachments.length > 0,
    [attachments.length, body]
  );

  useEffect(() => {
    return () => {
      for (const attachment of attachments) {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      }
    };
  }, [attachments]);

  const clearDraft = () => {
    setBody("");
    setAttachments((current) => {
      for (const attachment of current) {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      }
      return [];
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const submit = async () => {
    const trimmed = body.trim();
    if (!canSubmit || disabled || isSending) {
      return;
    }

    await onSend({
      body: trimmed,
      files: attachments.map((attachment) => attachment.file),
    });
    clearDraft();
  };

  const addFiles = (files: FileList | null) => {
    if (!files) {
      return;
    }

    setAttachments((current) => {
      const next = [...current];
      for (const file of Array.from(files)) {
        if (next.length >= MAX_ATTACHMENTS) {
          break;
        }

        const kind = inferAttachmentKind(file);
        if (!kind) {
          continue;
        }

        const duplicate = next.some(
          (attachment) =>
            attachment.file.name === file.name &&
            attachment.file.size === file.size &&
            attachment.file.lastModified === file.lastModified
        );

        if (duplicate) {
          continue;
        }

        next.push({
          id: `${file.name}-${file.lastModified}-${file.size}`,
          file,
          kind,
          previewUrl: kind === "image" ? URL.createObjectURL(file) : null,
        });
      }

      return next;
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) =>
      current.filter((attachment) => {
        if (attachment.id === id && attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
        return attachment.id !== id;
      })
    );
  };

  return (
    <div className="border-t px-5 py-4">
      <div className="rounded-2xl border bg-muted/20 p-3 shadow-sm">
        {attachments.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex min-w-0 items-center gap-2 rounded-xl border bg-background px-2 py-2"
              >
                {attachment.kind === "image" && attachment.previewUrl ? (
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.file.name}
                    className="size-10 rounded-lg object-cover"
                  />
                ) : attachment.kind === "pdf" ? (
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="size-4" />
                  </div>
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Paperclip className="size-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">
                    {attachment.file.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {attachmentLabel(attachment.kind)}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => removeAttachment(attachment.id)}
                  aria-label={`Remove ${attachment.file.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              ref={fileInputRef}
              type="file"
              aria-label="Attach files"
              accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              multiple
              onChange={(event) => addFiles(event.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isSending || attachments.length >= MAX_ATTACHMENTS}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="size-4" />
              Attach
            </Button>
            <span>Enter sends. Shift + Enter adds a new line.</span>
          </div>
          <Button
            onClick={() => void submit()}
            disabled={disabled || isSending || !canSubmit}
            size="sm"
          >
            {attachments.length > 0 ? (
              <ImageIcon className="size-4" />
            ) : (
              <SendHorizontal className="size-4" />
            )}
            {isSending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
