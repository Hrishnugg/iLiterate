import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Extract plain text from a PDF buffer using pdf-parse v2 (PDFParse class).
 * Dynamic import avoids Next.js build-time bundling issues with the heavy
 * pdfjs-dist bundle that pdf-parse wraps internally.
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");

  // Point the worker at the copy already present in node_modules.
  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "build",
    "pdf.worker.min.mjs"
  );
  PDFParse.setWorker(pathToFileURL(workerPath).href);

  const parser = new PDFParse({ data: buffer, verbosity: 0 });
  const result = await parser.getText();
  return result.text.trim();
}
