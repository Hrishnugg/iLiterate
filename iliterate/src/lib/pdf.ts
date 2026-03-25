type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type TextContentItem = {
  str: string;
  hasEOL: boolean;
};
type PdfDocumentInput = Parameters<PdfJsModule["getDocument"]>[0];

let cachedPdfJsModule: Promise<PdfJsModule> | null = null;

function loadPdfJsModule() {
  if (!cachedPdfJsModule) {
    cachedPdfJsModule = import("pdfjs-dist/legacy/build/pdf.mjs");
  }

  return cachedPdfJsModule;
}

function extractPageText(items: Array<TextContentItem | Record<string, unknown>>) {
  let pageText = "";

  for (const item of items) {
    if (!("str" in item) || typeof item.str !== "string") {
      continue;
    }

    pageText += item.str;
    if ("hasEOL" in item && item.hasEOL === true) {
      pageText += "\n";
    }
  }

  return pageText.trimEnd();
}

/**
 * Extract plain text from a PDF buffer, preserving the visual structure of
 * the original document as closely as possible.
 *
 * Strategy
 * --------
 * 1.  pdfjs-dist's Node-compatible legacy build reads the PDF and exposes page
 *     text items with inline space characters plus `hasEOL` line-break hints.
 * 2.  We flatten each page to raw text and then run a multi-pass post-processor
 *     to recover the document structure:
 *     a. Re-join soft hyphens and end-of-line hyphens (e.g. "analy-\nsis" → "analysis").
 *     b. Detect paragraph boundaries (gap > 1 line) and emit a blank-line separator.
 *     c. Strip stray mid-line tab characters if any parser inserts them.
 *     d. Collapse runs of 3+ blank lines to 2.
 *     e. Trim trailing whitespace from every line.
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const pdfjs = await loadPdfJsModule();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    verbosity: 0,
  } as PdfDocumentInput & { disableWorker: boolean });

  try {
    const pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent({
        includeMarkedContent: true,
        disableNormalization: false,
      });

      pages.push(extractPageText(textContent.items));
      page.cleanup();
    }

    return postProcess(pages.join("\n\n"));
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Post-processor
// ---------------------------------------------------------------------------

function postProcess(raw: string): string {
  const lines = raw.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const next = i + 1 < lines.length ? lines[i + 1].trimEnd() : null;

    // Blank line — paragraph separator, always preserve.
    if (line === "") {
      out.push("");
      continue;
    }

    // (a) Hyphenated line-break: "analy-" + "sis" → "analysis"
    // Keep the hyphen for compound words (short stem or non-vowel/non-space before hyphen).
    if (next !== null && next !== "" && line.endsWith("-") && /^[a-z\u00C0-\u024F]/.test(next)) {
      const stem = line.slice(0, -1);
      const keepHyphen = stem.length <= 4 || /[^aeiouAEIOU\s]$/.test(stem.slice(-2, -1));
      // Consume the next line by appending it to the current and skipping.
      const merged = keepHyphen ? stem + "-" + next : stem + next;
      out.push(merged);
      i++;
      continue;
    }

    // (b) Soft-wrap: join consecutive non-empty lines that are part of the
    //     same paragraph with a space.
    //
    //     A line is a paragraph continuation when:
    //       - It does NOT end with a sentence terminator (. ? ! : … " » —)
    //       - The next line is non-empty and starts with a lowercase letter
    //         or a mid-sentence punctuation character (opening quote, paren…)
    //
    //     We do NOT join when the next line looks like a new sentence/heading
    //     (starts with uppercase, digit followed by '.', or is all-caps).
    const endsWithTerminator = /[.?!:…"»—]$/.test(line) || /\.\s*$/.test(line);
    const containsCjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(
      `${line}${next ?? ""}`
    );
    const lineLooksWrappedProse =
      line.length >= 45 || line.split(/\s+/).filter(Boolean).length >= 8;
    const nextLooksWrappedProse =
      next !== null &&
      (next.length >= 20 || next.split(/\s+/).filter(Boolean).length >= 4);
    const nextIsContinuation =
      next !== null &&
      next !== "" &&
      !containsCjk &&
      lineLooksWrappedProse &&
      nextLooksWrappedProse &&
      /^[a-z\u00C0-\u024F("]/.test(next);

    if (!endsWithTerminator && nextIsContinuation) {
      // Start accumulating a paragraph.
      const parts: string[] = [line];
      i++;
      while (i < lines.length) {
        const cur = lines[i].trimEnd();
        const nxt = i + 1 < lines.length ? lines[i + 1].trimEnd() : null;

        if (cur === "") {
          // Blank line ends paragraph accumulation.
          i--; // outer loop will push the blank on its next iteration
          break;
        }

        // Handle hyphen at end of accumulated line.
        if (cur.endsWith("-") && nxt && nxt !== "" && /^[a-z\u00C0-\u024F]/.test(nxt)) {
          const stem = cur.slice(0, -1);
          const keepHyphen = stem.length <= 4 || /[^aeiouAEIOU\s]$/.test(stem.slice(-2, -1));
          parts.push(keepHyphen ? stem + "-" : stem);
          // Skip nxt as well — append it without space.
          i++;
          parts.push(lines[i].trimEnd());
          i++;
          continue;
        }

        parts.push(cur);
        i++;

        // Stop accumulating if this line ends with a terminator and the next
        // line starts a new sentence (uppercase or blank).
        const curEnds = /[.?!:…"»—]$/.test(cur) || /\.\s*$/.test(cur);
        const nxtNew = !nxt || nxt === "" || /^[A-Z\d\u4E00-\u9FFF]/.test(nxt);
        if (curEnds && nxtNew) break;
      }
      out.push(parts.join(" ").replace(/\s{2,}/g, " "));
      continue;
    }

    out.push(line);
  }

  return (
    out
      .join("\n")
      // Replace mid-line tabs (column artefacts) with a single space.
      .replace(/([^\n])\t([^\n])/g, "$1 $2")
      // Collapse 3+ consecutive blank lines to exactly 2.
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
