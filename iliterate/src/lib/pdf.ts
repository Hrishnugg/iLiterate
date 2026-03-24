import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Extract plain text from a PDF buffer using pdfjs-dist (already a project
 * dependency).  This replaces the previous pdf-parse class-based approach
 * whose worker path resolution was fragile in some environments.
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  // Dynamic import avoids Next.js build-time bundling issues.
  const pdfjsLib = await import("pdfjs-dist");

  // Point the worker at the copy already present in node_modules.
  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "build",
    "pdf.worker.min.mjs"
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

  const doc = await pdfjsLib
    .getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    })
    .promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: unknown) => ((item as { str?: string }).str ?? ""))
      .join(" ")
      .trim();
    if (text) pageTexts.push(text);
    page.cleanup();
  }

  await doc.destroy();
  return pageTexts.join("\n\n");
}
