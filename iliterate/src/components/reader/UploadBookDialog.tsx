"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, CheckCircle2, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "pick" | "uploading" | "done" | "error";

const DIFFICULTY_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export function UploadBookDialog({ onUploadedAction }: { onUploadedAction?: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("");
  const [difficulty, setDifficulty] = useState("B1");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ contentId: string; title: string } | null>(null);
  const router = useRouter();

  function reset() {
    setStep("pick");
    setFile(null);
    setTitle("");
    setLanguage("");
    setDifficulty("B1");
    setError(null);
    setResult(null);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Please select a file.");
    if (!language.trim()) return setError("Language is required.");
    setStep("uploading");
    setError(null);

    try {
      // Step 1 — upload file; server extracts text via pdfjs-dist / mammoth.
      const fd = new FormData();
      fd.append("file", file);
      fd.append("scope", "content_import");

      const uploadRes = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!uploadRes.ok) {
        const json = await uploadRes.json().catch(() => ({}));
        throw new Error((json as { error?: string })?.error ?? "File upload failed");
      }
      const uploadData = (await uploadRes.json()) as {
        id: string;
        extractedText: string | null;
        title: string | null;
      };

      const extractedText = uploadData.extractedText ?? "";
      if (!extractedText.trim()) {
        throw new Error(
          "Could not extract text from this file. Make sure the PDF contains selectable text (not a scanned image), or that the EPUB contains readable content."
        );
      }

      // Step 2 — create a content row so it appears under "My Content".
      const ext = file.name.toLowerCase().split(".").pop();
      const contentType =
        ext === "epub" ? "epub" : ext === "pdf" ? "pdf" : "article";

      const contentRes = await fetch("/api/content/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:
            title.trim() ||
            uploadData.title ||
            file.name.replace(/\.[^.]+$/, ""),
          body: extractedText,
          language: language.trim(),
          difficulty_level: difficulty,
          content_type: contentType,
          source_upload_id: uploadData.id,
        }),
      });
      if (!contentRes.ok) {
        const json = await contentRes.json().catch(() => ({}));
        throw new Error(
          (json as { error?: string })?.error ?? "Failed to add to library"
        );
      }
      const { id: contentId } = (await contentRes.json()) as { id: string };

      setResult({
        contentId,
        title:
          title.trim() ||
          uploadData.title ||
          file.name.replace(/\.[^.]+$/, ""),
      });
      setStep("done");
      onUploadedAction?.();
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Upload failed");
      setStep("error");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload file
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        {/* ── Step: file picker / error ─────────────────────────────── */}
        {(step === "pick" || step === "error") && (
          <>
            <DialogHeader>
              <DialogTitle>Upload a book or document</DialogTitle>
              <DialogDescription>
                Supported formats: PDF, EPUB, DOCX. Text is extracted and added
                to your <strong>My Content</strong> tab.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleUpload} className="mt-4 grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="ub-file">File</Label>
                <Input
                  id="ub-file"
                  type="file"
                  accept=".pdf,.epub,.docx,application/pdf,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="ub-lang">
                  Language <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ub-lang"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="e.g. Japanese, Spanish, French"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="ub-title">Title (optional)</Label>
                  <Input
                    id="ub-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Defaults to filename"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ub-diff">Difficulty</Label>
                  <select
                    id="ub-diff"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    {DIFFICULTY_LEVELS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <DialogFooter>
                <Button type="submit">Upload</Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    reset();
                    setOpen(false);
                  }}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {/* ── Step: uploading spinner ───────────────────────────────── */}
        {step === "uploading" && (
          <>
            <DialogHeader>
              <DialogTitle>Processing…</DialogTitle>
              <DialogDescription>
                Extracting text and adding to your library.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          </>
        )}

        {/* ── Step: success ─────────────────────────────────────────── */}
        {step === "done" && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Added to library!
              </DialogTitle>
              <DialogDescription>
                &ldquo;{result.title}&rdquo; is now in your{" "}
                <strong>My Content</strong> tab.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button asChild>
                <Link href={`/reader/${result.contentId}`}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Read now
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  reset();
                  setOpen(false);
                  router.refresh();
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default UploadBookDialog;
