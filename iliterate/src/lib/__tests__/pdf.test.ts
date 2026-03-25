// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { extractTextFromPdfBuffer } from "@/lib/pdf";

const FIXTURE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../宮城家_由来および近世以降の歩み_Internet Archive_20251220.pdf"
);

function setOptionalGlobal<T extends keyof typeof globalThis>(
  key: T,
  value: (typeof globalThis)[T] | undefined
) {
  if (typeof value === "undefined") {
    delete globalThis[key];
    return;
  }

  globalThis[key] = value;
}

describe("extractTextFromPdfBuffer", () => {
  it("extracts text when DOM canvas globals are initially missing", async () => {
    const previousDOMMatrix = globalThis.DOMMatrix;
    const previousImageData = globalThis.ImageData;
    const previousPath2D = globalThis.Path2D;

    setOptionalGlobal("DOMMatrix", undefined);
    setOptionalGlobal("ImageData", undefined);
    setOptionalGlobal("Path2D", undefined);

    try {
      const buffer = await readFile(FIXTURE_PATH);
      const text = await extractTextFromPdfBuffer(buffer);

      expect(text.length).toBeGreaterThan(500);
      expect(text).toContain("当家の由来および近世以降の歩みについて");
    } finally {
      setOptionalGlobal("DOMMatrix", previousDOMMatrix);
      setOptionalGlobal("ImageData", previousImageData);
      setOptionalGlobal("Path2D", previousPath2D);
    }
  });
});
