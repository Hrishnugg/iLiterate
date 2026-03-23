"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  CheckCircle2,
  ChevronLeft,
  FileImage,
  FileText,
  Link as LinkIcon,
  Loader2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ContentType } from "@/types/database";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  article: "Article",
  story: "Story",
  news: "News",
  dialogue: "Dialogue",
  menu: "Menu",
  sign: "Sign",
  pdf: "PDF",
  epub: "EPUB",
};

type ImportMethod = "pdf" | "photo" | "website";
type DialogStep = "select" | "file" | "url" | "processing" | "review";

interface ImportPreview {
  title: string;
  extractedText: string;
  language: string;
  difficulty: string;
  contentType: ContentType;
  contentTypeOptions: ContentType[];
  sourceUploadId?: string;
  sourceUrl?: string;
  previewUrl?: string | null;
}

interface ImportContentDialogProps {
  targetLanguage: string | null;
  onImported: (contentId: string) => void;
}

function getAcceptForMethod(method: ImportMethod | null) {
  if (method === "photo") {
    return "image/jpeg,image/png,image/webp";
  }

  if (method === "pdf") {
    return "application/pdf";
  }

  return "";
}

export function ImportContentDialog({
  targetLanguage,
  onImported,
}: ImportContentDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<DialogStep>("select");
  const [method, setMethod] = useState<ImportMethod | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const languageOptions = useMemo(
    () => Object.entries(LANGUAGE_NAMES),
    []
  );

  const reset = () => {
    setStep("select");
    setMethod(null);
    setWebsiteUrl("");
    setPreview(null);
    setError(null);
    setIsSaving(false);
  };

  const close = () => {
    setDialogOpen(false);
    reset();
  };

  const openFileStep = (nextMethod: ImportMethod) => {
    setMethod(nextMethod);
    setError(null);
    setStep(nextMethod === "website" ? "url" : "file");
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      reset();
    }
  };

  const startProcessing = () => {
    setError(null);
    setStep("processing");
  };

  const finishPreview = (nextPreview: ImportPreview) => {
    setPreview(nextPreview);
    setStep("review");
  };

  const handleFileImport = async (file: File) => {
    startProcessing();

    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("scope", "content_import");

      const uploadRes = await fetch("/api/uploads", {
        method: "POST",
        body: uploadData,
      });
      const uploadPayload = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadPayload.error ?? "Failed to upload file");
      }

      const previewRes = await fetch("/api/content/import-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: uploadPayload.id }),
      });
      const previewPayload = await previewRes.json();
      if (!previewRes.ok) {
        throw new Error(previewPayload.error ?? "Failed to process upload");
      }

      finishPreview({
        title: previewPayload.title,
        extractedText: previewPayload.extractedText,
        language: previewPayload.language || targetLanguage || "en",
        difficulty: previewPayload.difficulty,
        contentType: previewPayload.suggestedContentType,
        contentTypeOptions: previewPayload.contentTypeOptions,
        sourceUploadId: previewPayload.sourceUploadId,
        previewUrl: previewPayload.previewUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import file");
      setStep(method === "website" ? "url" : "file");
    }
  };

  const handleWebsiteImport = async () => {
    if (!websiteUrl.trim()) {
      setError("A website URL is required");
      return;
    }

    startProcessing();

    try {
      const response = await fetch("/api/content/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to import website");
      }

      finishPreview({
        title: payload.title,
        extractedText: payload.extractedText,
        language: payload.language || targetLanguage || "en",
        difficulty: payload.difficulty,
        contentType: payload.suggestedContentType,
        contentTypeOptions: payload.contentTypeOptions,
        sourceUrl: payload.sourceUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import website");
      setStep("url");
    }
  };

  const handleSave = async () => {
    if (!preview) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/content/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: preview.title.trim(),
          body: preview.extractedText,
          language: preview.language,
          difficulty_level: preview.difficulty,
          content_type: preview.contentType,
          source_url: preview.sourceUrl,
          source_upload_id: preview.sourceUploadId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save content");
      }

      close();
      onImported(payload.id);
      router.push(`/reader/${payload.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save content");
      setIsSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className="group mb-8 flex w-full items-center gap-4 rounded-xl border-2 border-dashed border-primary/25 px-6 py-5 text-left transition-all duration-200 hover:border-primary/50 hover:bg-primary/[0.03]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary/10">
          <Upload className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            Import content into your library
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Upload a PDF, snap a photo, or pull in a website to study it in iLiterate
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border/40 px-3 py-1 text-xs font-medium text-muted-foreground transition-all group-hover:border-primary/40 group-hover:text-primary">
          Add content
        </span>
      </button>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="flex items-center gap-2">
              {step !== "select" && (
                <button
                  onClick={() => {
                    setError(null);
                    setStep(step === "review" ? (method === "website" ? "url" : "file") : "select");
                  }}
                  className="mr-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <Upload className="h-4 w-4 text-primary" />
              <span>
                {step === "select" && "Import into your library"}
                {step === "file" && method === "pdf" && "Upload PDF"}
                {step === "file" && method === "photo" && "Upload photo"}
                {step === "url" && "Import from website"}
                {step === "processing" && "Processing import…"}
                {step === "review" && "Review imported content"}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-6">
            <AnimatePresence mode="popLayout" initial={false}>
              {step === "select" && (
                <motion.div
                  key="select"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  className="grid gap-3 pt-4 md:grid-cols-3"
                >
                  {[
                    {
                      id: "pdf",
                      title: "Upload PDF",
                      description: "Import a text-based PDF",
                      Icon: FileText,
                    },
                    {
                      id: "photo",
                      title: "Upload photo",
                      description: "OCR a sign, menu, or real-world text",
                      Icon: FileImage,
                    },
                    {
                      id: "website",
                      title: "From website",
                      description: "Save a clean article snapshot",
                      Icon: LinkIcon,
                    },
                  ].map(({ id, title, description, Icon }) => (
                    <button
                      key={id}
                      onClick={() => openFileStep(id as ImportMethod)}
                      className="group rounded-xl border border-border/40 bg-muted/30 px-4 py-5 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
                    >
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-background shadow-sm">
                        <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">{title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                    </button>
                  ))}
                </motion.div>
              )}

              {step === "file" && method && (
                <motion.div
                  key="file"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  className="pt-4"
                >
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const file = event.dataTransfer.files?.[0];
                      if (file) {
                        void handleFileImport(file);
                      }
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    className="flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border/50 px-8 py-12 text-center transition-colors hover:border-primary/40 hover:bg-primary/[0.02]"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                      {method === "pdf" ? (
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      ) : (
                        <FileImage className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {method === "pdf"
                          ? "Drop a text PDF here"
                          : "Drop a photo here"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        or click to browse your device
                      </p>
                    </div>
                    <span className="rounded-full border border-border/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">
                      Select file
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={getAcceptForMethod(method)}
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) {
                        void handleFileImport(file);
                      }
                    }}
                  />
                </motion.div>
              )}

              {step === "url" && (
                <motion.div
                  key="url"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  className="space-y-4 pt-4"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Website URL
                    </label>
                    <input
                      value={websiteUrl}
                      onChange={(event) => setWebsiteUrl(event.target.value)}
                      placeholder="https://example.com/article"
                      className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                  <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                    iLiterate will fetch the page, strip the chrome, and save a clean reading snapshot into your private library.
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={close}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => void handleWebsiteImport()}>
                      Import website
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === "processing" && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  className="flex flex-col items-center gap-4 py-16"
                >
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      Preparing your import
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Extracting text, detecting language, and getting it ready for review.
                    </p>
                  </div>
                </motion.div>
              )}

              {step === "review" && preview && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  className="space-y-4 pt-2"
                >
                  <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <p className="text-xs text-primary">
                      Extracted {preview.extractedText.trim().split(/\s+/).length.toLocaleString()} words
                    </p>
                  </div>

                  {preview.previewUrl && (
                    <div className="overflow-hidden rounded-xl border border-border/40 bg-muted/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview.previewUrl}
                        alt="Imported preview"
                        className="max-h-48 w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Title</label>
                    <input
                      value={preview.title}
                      onChange={(event) =>
                        setPreview((current) =>
                          current ? { ...current, title: event.target.value } : current
                        )
                      }
                      className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        Language
                      </label>
                      <select
                        value={preview.language}
                        onChange={(event) =>
                          setPreview((current) =>
                            current
                              ? { ...current, language: event.target.value }
                              : current
                          )
                        }
                        className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
                      >
                        {languageOptions.map(([code, name]) => (
                          <option key={code} value={code}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        Difficulty
                      </label>
                      <select
                        value={preview.difficulty}
                        onChange={(event) =>
                          setPreview((current) =>
                            current
                              ? { ...current, difficulty: event.target.value }
                              : current
                          )
                        }
                        className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
                      >
                        {["A1", "A2", "B1", "B2", "C1", "C2"].map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        Content type
                      </label>
                      <select
                        value={preview.contentType}
                        onChange={(event) =>
                          setPreview((current) =>
                            current
                              ? {
                                  ...current,
                                  contentType: event.target.value as ContentType,
                                }
                              : current
                          )
                        }
                        className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
                      >
                        {preview.contentTypeOptions.map((type) => (
                          <option key={type} value={type}>
                            {CONTENT_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Extracted text
                    </label>
                    <textarea
                      value={preview.extractedText}
                      onChange={(event) =>
                        setPreview((current) =>
                          current
                            ? { ...current, extractedText: event.target.value }
                            : current
                        )
                      }
                      rows={14}
                      className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Clean up OCR mistakes or trim the content before saving it to your library.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={close}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void handleSave()}
                      disabled={
                        isSaving ||
                        !preview.title.trim() ||
                        !preview.extractedText.trim()
                      }
                    >
                      {isSaving ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Save &amp; read
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <p className="mt-4 text-xs text-destructive">{error}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
