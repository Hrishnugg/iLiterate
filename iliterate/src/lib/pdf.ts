import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { PDFParse } from "pdf-parse";

let configuredWorkerUrl: string | null = null;

function resolvePdfWorkerUrl(): string {
  if (configuredWorkerUrl) {
    return configuredWorkerUrl;
  }

  const packageRoots = [
    path.join(process.cwd(), "node_modules", "pdf-parse"),
    path.resolve(process.cwd(), "..", "node_modules", "pdf-parse"),
  ];
  const workerCandidates = [
    "dist/pdf-parse/cjs/pdf.worker.mjs",
    "dist/pdf-parse/esm/pdf.worker.mjs",
    "dist/worker/pdf.worker.mjs",
  ];

  for (const packageRoot of packageRoots) {
    for (const relativePath of workerCandidates) {
      const absolutePath = path.join(packageRoot, relativePath);
      if (existsSync(absolutePath)) {
        configuredWorkerUrl = pathToFileURL(absolutePath).toString();
        return configuredWorkerUrl;
      }
    }
  }

  throw new Error("Unable to locate pdf-parse worker module");
}

function ensurePdfWorkerConfigured() {
  PDFParse.setWorker(resolvePdfWorkerUrl());
}

export async function extractTextFromPdfBuffer(buffer: Buffer) {
  ensurePdfWorkerConfigured();

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}
