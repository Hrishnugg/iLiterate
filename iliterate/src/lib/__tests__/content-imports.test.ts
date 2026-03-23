import { describe, expect, it } from "vitest";

import {
  estimateReadingTimeMinutes,
  formatImportedTextAsHtml,
  suggestContentType,
  suggestTitleFromFilename,
} from "@/lib/content-imports";

describe("content import helpers", () => {
  it("formats paragraphs into safe HTML", () => {
    const html = formatImportedTextAsHtml("Hello world\n\nThis is a test");

    expect(html).toContain("<p>Hello world</p>");
    expect(html).toContain("<p>This is a test</p>");
  });

  it("detects short excerpts as signs", () => {
    expect(suggestContentType("Do not enter\nAuthorized personnel only")).toBe(
      "sign"
    );
  });

  it("detects menu-like text", () => {
    expect(
      suggestContentType("Soup $4.00\nSalad $8.00\nPasta $12.00\nDessert $6.00")
    ).toBe("menu");
  });

  it("creates a friendly title from filenames", () => {
    expect(suggestTitleFromFilename("tokyo-station-guide.pdf")).toBe(
      "Tokyo Station Guide"
    );
  });

  it("estimates reading time with a one-minute floor", () => {
    expect(estimateReadingTimeMinutes("short text")).toBe(1);
    expect(estimateReadingTimeMinutes(new Array(401).fill("word").join(" "))).toBe(
      2
    );
  });
});
