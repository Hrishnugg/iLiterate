import { load } from "cheerio";

import {
  detectContentMetadata,
  extractTextFromImage,
} from "@/lib/google-ai";
import { extractTextFromPdfBuffer } from "@/lib/pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { UPLOADS_BUCKET, inferUploadKind } from "@/lib/uploads";
import type { CEFRLevel, ContentType, UserUpload } from "@/types/database";

const IMAGE_PROMPT_LIMIT_BYTES = 15 * 1024 * 1024;
const WEBSITE_TEXT_LIMIT = 100_000;
const IMPORTABLE_CONTENT_TYPES: ContentType[] = ["article", "sign", "menu"];

export interface UploadImportPreview {
  sourceUploadId: string;
  uploadKind: "image" | "pdf" | "epub";
  title: string;
  extractedText: string;
  language: string;
  difficulty: CEFRLevel;
  suggestedContentType: ContentType;
  contentTypeOptions: ContentType[];
  previewUrl: string | null;
}

export interface UrlImportPreview {
  sourceUrl: string;
  title: string;
  extractedText: string;
  language: string;
  difficulty: CEFRLevel;
  suggestedContentType: ContentType;
  contentTypeOptions: ContentType[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function titleCase(text: string): string {
  return text
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatImportedTextAsHtml(text: string): string {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      if (/^[-*•]\s/.test(paragraph)) {
        const items = paragraph
          .split("\n")
          .map((line) => line.replace(/^[-*•]\s*/, "").trim())
          .filter(Boolean)
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }

      return `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}

export function countWords(text: string): number {
  return normalizeWhitespace(text).split(/\s+/).filter(Boolean).length;
}

export function estimateReadingTimeMinutes(text: string): number {
  return Math.max(1, Math.round(countWords(text) / 200));
}

function isMenuLike(text: string): boolean {
  const lines = normalizeWhitespace(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const shortLines = lines.filter((line) => line.length <= 40).length;
  const priceLike = lines.filter((line) => /[$€£¥]\s?\d|\d+\.\d{2}/.test(line)).length;
  return lines.length >= 4 && (priceLike >= 2 || shortLines / lines.length > 0.6);
}

export function suggestContentType(text: string): ContentType {
  const normalized = normalizeWhitespace(text);
  const lineCount = normalized.split("\n").filter(Boolean).length;

  if (isMenuLike(normalized)) {
    return "menu";
  }

  if (normalized.length <= 180 && lineCount <= 6) {
    return "sign";
  }

  return "article";
}

export function suggestTitleFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  return titleCase(withoutExtension) || "Imported Content";
}

async function createSignedUrl(storagePath: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(UPLOADS_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function downloadUploadBuffer(storagePath: string): Promise<Buffer> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(UPLOADS_BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new Error("Failed to download uploaded file");
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const text = await extractTextFromPdfBuffer(buffer);
  return normalizeWhitespace(text);
}

function pickReadableRoot(html: string) {
  const $ = load(html);
  $("script, style, noscript, iframe, svg, header, footer, nav, form, aside").remove();

  let root = $("article").first();
  if (root.length === 0) {
    root = $("main").first();
  }
  if (root.length === 0) {
    root = $('[role="main"]').first();
  }
  if (root.length === 0) {
    root = $("body").first();
  }

  return { $, root };
}

function extractUrlText(html: string): { title: string; extractedText: string } {
  const { $, root } = pickReadableRoot(html);
  const title =
    $("meta[property='og:title']").attr("content")?.trim() ||
    $("title").first().text().trim() ||
    root.find("h1").first().text().trim() ||
    "Imported Website";

  const blocks = root
    .find("h1, h2, h3, p, li, blockquote")
    .toArray()
    .map((node) => $(node).text().replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const extractedText = normalizeWhitespace(
    blocks.join("\n\n").slice(0, WEBSITE_TEXT_LIMIT)
  );

  if (!extractedText) {
    throw new Error("No readable text found on this page");
  }

  return { title, extractedText };
}

export async function extractUploadPreview(
  upload: Pick<
    UserUpload,
    | "id"
    | "storage_path"
    | "mime_type"
    | "original_filename"
    | "kind"
    | "title"
    | "extracted_text"
  >
): Promise<UploadImportPreview> {
  const mimeType = upload.mime_type ?? "";
  const kind = inferUploadKind(mimeType, upload.original_filename ?? "");

  if (kind !== "image" && kind !== "pdf" && kind !== "epub") {
    throw new Error("Only PDF, EPUB, and image imports are supported in the library");
  }

  let extractedText = normalizeWhitespace(upload.extracted_text ?? "");
  if (!extractedText) {
    const buffer = await downloadUploadBuffer(upload.storage_path);

    if (kind === "pdf") {
      extractedText = await extractPdfText(buffer);
      if (!extractedText) {
        throw new Error(
          "No text found in the PDF. Only text-based PDFs are supported in this import flow."
        );
      }
    } else if (kind === "epub") {
      const { extractUploadPayload } = await import("@/lib/uploads");
      const payload = await extractUploadPayload({
        buffer,
        filename: upload.original_filename ?? "book.epub",
        mimeType: upload.mime_type ?? "application/epub+zip",
      });
      extractedText = normalizeWhitespace(payload.text ?? "");
      if (!extractedText) {
        throw new Error("No text could be extracted from this EPUB file.");
      }
    } else {
      if (buffer.byteLength > IMAGE_PROMPT_LIMIT_BYTES) {
        throw new Error("Image is too large to process");
      }
      extractedText = normalizeWhitespace(
        await extractTextFromImage(buffer, mimeType || "image/jpeg")
      );
      if (!extractedText) {
        throw new Error("No readable text found in the image");
      }
    }
  }

  const metadata = await detectContentMetadata(extractedText);
  const isEpub = kind === "epub";
  const isPdf = kind === "pdf";
  return {
    sourceUploadId: upload.id,
    uploadKind: kind as "image" | "pdf" | "epub",
    title: upload.title?.trim()
      || (upload.original_filename && upload.original_filename.trim().length > 0
        ? suggestTitleFromFilename(upload.original_filename)
        : "Imported Content"),
    extractedText,
    language: metadata.language,
    difficulty: metadata.difficulty,
    suggestedContentType: isEpub ? "epub" : isPdf ? "pdf" : suggestContentType(extractedText),
    contentTypeOptions: isEpub
      ? (["epub", ...IMPORTABLE_CONTENT_TYPES] as ContentType[])
      : isPdf
      ? (["pdf", ...IMPORTABLE_CONTENT_TYPES] as ContentType[])
      : IMPORTABLE_CONTENT_TYPES,
    previewUrl: kind === "image" ? await createSignedUrl(upload.storage_path) : null,
  };
}

export async function extractUrlPreview(url: string): Promise<UrlImportPreview> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; iLiterateBot/1.0; +https://iliterate.local)",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    throw new Error("The URL did not return an HTML page");
  }

  const html = await response.text();
  const { title, extractedText } = extractUrlText(html);
  const metadata = await detectContentMetadata(extractedText);

  return {
    sourceUrl: url,
    title,
    extractedText,
    language: metadata.language,
    difficulty: metadata.difficulty,
    suggestedContentType: "article",
    contentTypeOptions: ["article"],
  };
}
