import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export type UploadScope = "content_import" | "study_chat" | "dm_attachment";
export type UploadStatus = "uploaded" | "processed" | "failed";
export type UploadKind = "image" | "pdf" | "docx" | "unknown";
export const UPLOADS_BUCKET = "user-uploads";
export const SUPPORTED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
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
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
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
