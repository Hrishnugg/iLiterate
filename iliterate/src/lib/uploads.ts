import AdmZip from "adm-zip";
import { load } from "cheerio";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";

import { extractTextFromPdfBuffer } from "@/lib/pdf";

export type UploadScope = "content_import" | "study_chat" | "dm_attachment";
export type UploadStatus = "uploaded" | "processed" | "failed";
export type UploadKind = "image" | "pdf" | "docx" | "epub" | "unknown";
export const UPLOADS_BUCKET = "user-uploads";
export const SUPPORTED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "application/epub+zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MIME_TYPE_ALIASES = new Map<string, string>([
  ["application/x-pdf", "application/pdf"],
  ["application/acrobat", "application/pdf"],
  ["applications/vnd.pdf", "application/pdf"],
  ["text/pdf", "application/pdf"],
  ["application/x-epub+zip", "application/epub+zip"],
  ["application/octet-stream", "application/octet-stream"],
]);

export interface ExtractedUploadPayload {
  title: string;
  text: string | null;
  mimeType: string;
  status: UploadStatus;
}

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not set in environment variables");
  }
  return new GoogleGenerativeAI(apiKey);
}

function sanitizeFilename(filename: string) {
  return filename
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function extractPdfText(buffer: Buffer) {
  return extractTextFromPdfBuffer(buffer);
}

async function extractDocxText(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

const EPUB_MAX_CHARS = 500_000;

async function extractEpubText(buffer: Buffer): Promise<string> {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const parts: string[] = [];
  let totalChars = 0;

  for (const entry of entries) {
    const name = entry.entryName.toLowerCase();
    if (!name.endsWith(".html") && !name.endsWith(".xhtml") && !name.endsWith(".htm")) {
      continue;
    }
    // Skip nav / table of contents documents
    if (name.includes("nav") || name.includes("toc")) {
      continue;
    }
    try {
      const html = entry.getData().toString("utf-8");
      const $ = load(html);
      // Remove non-content tags
      $("script, style, noscript, nav, aside").remove();
      const text = $("body").text().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      if (text.length > 0) {
        const remaining = EPUB_MAX_CHARS - totalChars;
        if (remaining <= 0) break;
        const chunk = text.length > remaining ? text.slice(0, remaining) : text;
        parts.push(chunk);
        totalChars += chunk.length;
      }
    } catch {
      // skip unreadable entries
    }
  }

  return parts.join("\n\n").trim();
}

async function extractImageText(buffer: Buffer, mimeType: string) {
  const model = getGeminiClient().getGenerativeModel({
    model: "gemini-2.5-flash",
  });

  const result = await model.generateContent([
    {
      text: [
        "Extract all visible text from this image for a language-learning app.",
        "Return plain text only.",
        "Preserve line breaks where they help readability.",
        "Do not add commentary.",
      ].join(" "),
    },
    {
      inlineData: {
        mimeType,
        data: buffer.toString("base64"),
      },
    },
  ]);

  return result.response.text().trim();
}

export async function extractUploadPayload(input: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<ExtractedUploadPayload> {
  const { buffer, filename, mimeType } = input;
  const lowerName = filename.toLowerCase();
  const title = filename.replace(/\.[^.]+$/, "").trim() || "Untitled upload";

  try {
    let text: string | null = null;

    if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
      text = await extractPdfText(buffer);
    } else if (mimeType === "application/epub+zip" || lowerName.endsWith(".epub")) {
      text = await extractEpubText(buffer);
    } else if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lowerName.endsWith(".docx")
    ) {
      text = await extractDocxText(buffer);
    } else if (mimeType.startsWith("image/")) {
      text = await extractImageText(buffer, mimeType);
    }

    return {
      title,
      text: text && text.length > 0 ? text : null,
      mimeType,
      status: text && text.length > 0 ? "processed" : "uploaded",
    };
  } catch (error) {
    console.error("Upload extraction failed:", error);
    return {
      title,
      text: null,
      mimeType,
      status: "failed",
    };
  }
}

export function buildStoragePath(scope: UploadScope, userId: string, filename: string) {
  const safeName = sanitizeFilename(filename || "upload");
  return `${scope}/${userId}/${Date.now()}-${safeName}`;
}

export function resolveUploadMimeType(
  mimeType: string | null | undefined,
  filename: string
): string | null {
  const normalizedMimeType = mimeType?.trim().toLowerCase() ?? "";
  if (SUPPORTED_UPLOAD_MIME_TYPES.has(normalizedMimeType)) {
    return normalizedMimeType;
  }

  const aliasMimeType = MIME_TYPE_ALIASES.get(normalizedMimeType);
  if (aliasMimeType && aliasMimeType !== "application/octet-stream") {
    return aliasMimeType;
  }

  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (lowerName.endsWith(".epub")) {
    return "application/epub+zip";
  }
  if (lowerName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lowerName.endsWith(".png")) {
    return "image/png";
  }
  if (lowerName.endsWith(".webp")) {
    return "image/webp";
  }

  return null;
}

export function inferAttachmentType(mimeType: string, filename: string) {
  const lowerName = filename.toLowerCase();

  if (mimeType.startsWith("image/")) return "image" as const;
  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "pdf" as const;
  }

  return "docx" as const;
}

export function inferUploadKind(mimeType: string, filename = ""): UploadKind {
  const lowerName = filename.toLowerCase();

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "pdf";
  }
  if (mimeType === "application/epub+zip" || lowerName.endsWith(".epub")) {
    return "epub";
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return "docx";
  }

  return "unknown";
}

export function inferContentType(text: string, mimeType: string) {
  const compact = text.trim();
  const lineCount = compact.split(/\n+/).length;
  const wordCount = compact.split(/\s+/).filter(Boolean).length;

  if (mimeType.startsWith("image/")) {
    if (wordCount <= 20 && lineCount <= 6) {
      return "sign";
    }
    if (wordCount <= 80 && /[$€£¥]|menu|price|special/i.test(compact)) {
      return "menu";
    }
  }

  return "article";
}
