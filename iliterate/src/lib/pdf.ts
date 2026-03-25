import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Extract plain text from a PDF buffer, preserving the visual structure of
 * the original document as closely as possible.
 *
 * Strategy
 * --------
 * 1.  pdf-parse v2 getText() gives us raw text with line-break hints injected
 *     whenever the y-position jumps between consecutive text items.
 * 2.  We then run a multi-pass post-processor to recover the document structure:
 *     a. Re-join soft hyphens and end-of-line hyphens (e.g. "analy-\nsis" → "analysis").
 *     b. Detect paragraph boundaries (gap > 1 line) and emit a blank-line separator.
 *     c. Strip mid-line tab characters inserted by pdf-parse's column detector
 *        (justified text produces irregular x-jumps that shouldn't become tabs).
 *     d. Collapse runs of 3+ blank lines to 2.
 *     e. Trim trailing whitespace from every line.
 *
 * createRequire bypasses Next.js bundling (which breaks pdf-parse's CJS adapters).
 * The worker must be the one bundled inside pdf-parse to avoid a version mismatch.
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const require = createRequire(import.meta.url);
  const { PDFParse } = require("pdf-parse") as {
    PDFParse: {
      new (opts: { data: Buffer; verbosity?: number }): {
        getText(opts?: {
          lineEnforce?: boolean;
          lineThreshold?: number;
          cellSeparator?: string;
          cellThreshold?: number;
          pageJoiner?: string;
          includeMarkedContent?: boolean;
          disableNormalization?: boolean;
        }): Promise<{ text: string; pages: Array<{ text: string; num: number }> }>;
      };
      setWorker(src?: string): string;
    };
  };

  // Use the worker that ships with pdf-parse itself to guarantee version match.
  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "pdf-parse",
    "dist",
    "worker",
    "pdf.worker.mjs"
  );
  PDFParse.setWorker(pathToFileURL(workerPath).href);

  const parser = new PDFParse({ data: buffer, verbosity: 0 });
  const result = await parser.getText({
    // Only break lines when y shifts by more than ~half a typical line height.
    // 8pt avoids spurious breaks from baseline micro-variations and superscripts
    // while still detecting actual new lines (typical line spacing is 12-16pt).
    lineEnforce: true,
    lineThreshold: 8,
    // Very high column threshold — tab only for genuine multi-column layouts,
    // never for normal word spacing in justified paragraphs.
    cellSeparator: "\t",
    cellThreshold: 80,
    // Each page ends with a double newline (no "page N of M" banner).
    pageJoiner: "\n\n",
    // Keep marked-content spans (tagged headings, lists, etc.).
    includeMarkedContent: true,
    disableNormalization: false,
  });

  return postProcess(result.text);
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
    const nextIsContinuation =
      next !== null &&
      next !== "" &&
      /^[a-z\u00C0-\u024F\u3040-\u9FFF\uAC00-\uD7AF("]/.test(next);

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
