import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContentRenderer } from "../ContentRenderer";
import type { Content, Highlight } from "@/types/database";
import type { TextSelection } from "../TextHighlighter";

function makeContent(overrides: Partial<Content> = {}): Content {
  return {
    id: "content-1",
    title: "Sample Title",
    body: "<p>Alpha <strong>Beta</strong> Gamma</p><p>Delta Epsilon</p>",
    language: "english",
    difficulty_level: "A2",
    content_type: "article",
    topic_tags: [],
    word_count: 120,
    estimated_reading_time: 1,
    source_url: null,
    source_upload_id: null,
    is_generated: false,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeHighlight(overrides: Partial<Highlight> = {}): Highlight {
  return {
    id: "highlight-1",
    user_id: "user-1",
    content_id: "content-1",
    position_type: "offset",
    start_position: "17",
    end_position: "22",
    selected_text: "Delta",
    context_before: " Gamma",
    context_after: " Epsilon",
    note: "Important word",
    translation: "translated delta",
    transliteration: null,
    part_of_speech: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createSelection(text: string, startOffset: number): TextSelection {
  const range = document.createRange();
  return {
    text,
    startOffset,
    endOffset: startOffset + text.length,
    contextBefore: "",
    contextAfter: "",
    range,
  };
}

function selectText(node: Text, start: number, end: number) {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe("ContentRenderer", () => {
  it("renders saved highlights and current selection into the processed article body", async () => {
    const highlight = makeHighlight();
    const onSelection = vi.fn();

    render(
      <ContentRenderer
        content={makeContent()}
        highlights={[highlight]}
        currentSelection={createSelection("Beta", 12)}
        onSelection={onSelection}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Sample Title")).toBeInTheDocument();
    });

    const savedHighlight = document.querySelector(
      'mark[data-highlight-id="highlight-1"]'
    );
    const currentSelection = document.querySelector(
      'mark[data-current-selection="true"]'
    );

    expect(savedHighlight).toHaveTextContent("Delta");
    expect(currentSelection).toHaveTextContent("Beta");
  });

  it("calls the highlight click callback with the matching highlight object", async () => {
    const highlight = makeHighlight();
    const onHighlightClick = vi.fn();

    render(
      <ContentRenderer
        content={makeContent()}
        highlights={[highlight]}
        onHighlightClick={onHighlightClick}
      />
    );

    const mark = await waitFor(() =>
      document.querySelector('mark[data-highlight-id="highlight-1"]')
    );

    if (!(mark instanceof HTMLElement)) {
      throw new Error("Expected rendered highlight mark");
    }

    fireEvent.click(mark);
    expect(onHighlightClick).toHaveBeenCalledWith(highlight);
  });

  it("calculates selection offsets and context against the full content container", async () => {
    const onSelection = vi.fn();

    render(
      <ContentRenderer content={makeContent()} onSelection={onSelection} />
    );

    await waitFor(() => {
      expect(screen.getByText("Sample Title")).toBeInTheDocument();
    });

    const deltaNode = screen.getByText(/Delta Epsilon/).firstChild as Text;
    const contentRoot = screen.getByText("Sample Title").closest(".space-y-6");

    if (!contentRoot) {
      throw new Error("Expected content root");
    }

    selectText(deltaNode, 0, 5);
    fireEvent.mouseUp(contentRoot.querySelector("div") as HTMLElement);

    const payload = onSelection.mock.calls.at(-1)?.[0];
    const fullText = (contentRoot.textContent ?? "").trim();
    const expectedStart = fullText.indexOf("Delta");
    const expectedEnd = expectedStart + "Delta".length;

    expect(payload).toMatchObject({
      text: "Delta",
      startOffset: expectedStart,
      endOffset: expectedEnd,
      contextBefore: fullText.slice(Math.max(0, expectedStart - 50), expectedStart),
      contextAfter: fullText.slice(expectedEnd, expectedEnd + 50),
    });
    expect(payload.range).toBeInstanceOf(Range);
  });
});
