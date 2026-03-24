"use client";

import * as React from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function UploadBookDialog({ onUploaded }: { onUploaded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Please select a file to upload.");
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("scope", "content_import");
      if (title) fd.append("title", title);
      if (language) fd.append("language", language);

      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "Upload failed");
      }

      setOpen(false);
      setFile(null);
      setTitle("");
      setLanguage("");
      if (onUploaded) onUploaded();
      else router.refresh();
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Upload book / file</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload a book or document</DialogTitle>
          <DialogDescription>Supported: EPUB, PDF. We'll store the file and process text in background.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleUpload} className="mt-4 grid gap-3">
          <div>
            <Label>File</Label>
            <Input type="file" accept=".pdf,.epub,application/epub+zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label>Title (optional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title" />
          </div>
          <div>
            <Label>Language (optional)</Label>
            <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="e.g. ja, en" />
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <DialogFooter>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>{loading ? "Uploading…" : "Upload"}</Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default UploadBookDialog;
