"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import DOMPurify from "dompurify";
import { Download, ExternalLink, FileImage, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DirectMessageAttachment } from "@/types/database";

const PDFRenderer = dynamic(
  () => import("@/components/reader/PDFRenderer").then((mod) => mod.PDFRenderer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[18rem] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface AttachmentPreviewDialogProps {
  attachment: DirectMessageAttachment | null;
  open: boolean;
  loading: boolean;
  error: string | null;
  url: string | null;
  previewHtml?: string | null;
  previewText?: string | null;
  onOpenChange: (open: boolean) => void;
  onOpenFile?: () => void;
  onDownloadFile?: () => void;
}

function attachmentLabel(type: DirectMessageAttachment["attachment_type"]) {
  switch (type) {
    case "image":
      return "Image";
    case "pdf":
      return "PDF document";
    case "docx":
      return "Word document";
  }
}

export function AttachmentPreviewDialog({
  attachment,
  open,
  loading,
  error,
  url,
  previewHtml,
  previewText,
  onOpenChange,
  onOpenFile,
  onDownloadFile,
}: AttachmentPreviewDialogProps) {
  const sanitizedDocHtml = useMemo(() => {
    if (!previewHtml) {
      return "";
    }

    return DOMPurify.sanitize(previewHtml, {
      ALLOWED_TAGS: [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "br",
        "hr",
        "ul",
        "ol",
        "li",
        "blockquote",
        "pre",
        "code",
        "strong",
        "em",
        "b",
        "i",
        "u",
        "s",
        "a",
        "span",
        "div",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "colspan", "rowspan", "class"],
    });
  }, [previewHtml]);

  const title =
    attachment?.file_name ??
    attachmentLabel(attachment?.attachment_type ?? "pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-w-6xl flex-col overflow-hidden p-0 sm:max-w-6xl">
        {attachment ? (
          <>
            <DialogHeader className="border-b px-6 py-4 text-left">
              <div className="flex items-start justify-between gap-4 pr-10">
                <div className="min-w-0">
                  <DialogTitle className="truncate text-base">{title}</DialogTitle>
                  <DialogDescription className="mt-1">
                    {attachmentLabel(attachment.attachment_type)}
                    {attachment.attachment_type === "docx"
                      ? " preview"
                      : attachment.attachment_type === "pdf"
                        ? " reader"
                        : " preview"}
                  </DialogDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {onDownloadFile ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onDownloadFile}
                    >
                      <Download className="size-3.5" />
                      Download
                    </Button>
                  ) : null}
                  {onOpenFile ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onOpenFile}
                    >
                      <ExternalLink className="size-3.5" />
                      Open file
                    </Button>
                  ) : null}
                </div>
              </div>
            </DialogHeader>

            <div
              className={cn(
                "min-h-0 flex-1",
                attachment.attachment_type === "pdf" ? "bg-background" : "bg-muted/20"
              )}
            >
              {loading ? (
                <div className="flex h-full min-h-[18rem] items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading preview...
                  </div>
                </div>
              ) : error ? (
                <div className="flex h-full min-h-[18rem] items-center justify-center p-6">
                  <div className="max-w-md rounded-2xl border bg-background px-6 py-5 text-center shadow-sm">
                    <p className="font-medium">Preview unavailable</p>
                    <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                  </div>
                </div>
              ) : attachment.attachment_type === "image" ? (
                <div className="flex h-full items-center justify-center p-6">
                  {url ? (
                    <img
                      src={url}
                      alt={attachment.file_name ?? "Shared image"}
                      className="max-h-full max-w-full rounded-2xl border bg-background object-contain shadow-sm"
                    />
                  ) : (
                    <div className="flex h-48 w-full max-w-md items-center justify-center rounded-2xl border bg-background text-muted-foreground shadow-sm">
                      <div className="flex items-center gap-2 text-sm">
                        <FileImage className="size-4" />
                        Image preview unavailable
                      </div>
                    </div>
                  )}
                </div>
              ) : attachment.attachment_type === "pdf" ? (
                <div className="h-full min-h-0">
                  {url ? (
                    <PDFRenderer
                      url={url}
                      contentId={`dm-attachment-${attachment.id}`}
                      integratedToolbar
                    />
                  ) : (
                    <div className="flex h-full min-h-[18rem] items-center justify-center rounded-2xl border bg-background shadow-sm">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="size-4" />
                        PDF preview unavailable
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full overflow-y-auto p-6">
                  <article className="mx-auto max-w-3xl rounded-2xl border bg-background px-8 py-8 shadow-sm">
                    {sanitizedDocHtml ? (
                      <div
                        className="space-y-4 text-[15px] leading-7 [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:mb-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted/70 [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-6"
                        dangerouslySetInnerHTML={{ __html: sanitizedDocHtml }}
                      />
                    ) : previewText ? (
                      <pre className="whitespace-pre-wrap text-[15px] leading-7 text-foreground">
                        {previewText}
                      </pre>
                    ) : (
                      <div className="flex min-h-[18rem] items-center justify-center text-sm text-muted-foreground">
                        Document preview unavailable
                      </div>
                    )}
                  </article>
                </div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
