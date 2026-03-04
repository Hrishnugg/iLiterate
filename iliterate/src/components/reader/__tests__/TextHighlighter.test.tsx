import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TextHighlighter, createHighlightSpan } from "../TextHighlighter";

function selectRange(node: Text, start: number, end: number) {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe("TextHighlighter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits normalized selection payload with offsets and context", async () => {
    const onSelection = vi.fn();
    render(
      <TextHighlighter onSelection={onSelection}>
        <p data-testid="reader-text">Hello brave new world</p>
      </TextHighlighter>
    );

    const paragraph = screen.getByTestId("reader-text");
    const container = paragraph.parentElement as HTMLDivElement;
    const textNode = paragraph.firstChild as Text;

    fireEvent.mouseDown(container);
    selectRange(textNode, 6, 11);
    fireEvent.mouseUp(container);
    act(() => {
      vi.advanceTimersByTime(20);
    });

    const payload = onSelection.mock.calls.at(-1)?.[0];
    expect(payload).toMatchObject({
      text: "brave",
      startOffset: 6,
      endOffset: 11,
      contextBefore: "Hello ",
      contextAfter: " new world",
    });
    expect(payload.range).toBeInstanceOf(Range);
  });

  it("clears selection when clicking outside the content area", async () => {
    const onSelection = vi.fn();
    render(
      <TextHighlighter onSelection={onSelection}>
        <p data-testid="reader-text">Hello brave new world</p>
      </TextHighlighter>
    );

    const paragraph = screen.getByTestId("reader-text");
    const container = paragraph.parentElement as HTMLDivElement;
    const textNode = paragraph.firstChild as Text;

    fireEvent.mouseDown(container);
    selectRange(textNode, 6, 11);
    fireEvent.mouseUp(container);
    act(() => {
      vi.advanceTimersByTime(20);
    });

    fireEvent.mouseDown(document.body);

    expect(onSelection).toHaveBeenLastCalledWith(null);
    expect(window.getSelection()?.rangeCount).toBe(0);
  });

  it("returns null selection payload for collapsed selections", async () => {
    const onSelection = vi.fn();
    render(
      <TextHighlighter onSelection={onSelection}>
        <p data-testid="reader-text">Hello brave new world</p>
      </TextHighlighter>
    );

    const paragraph = screen.getByTestId("reader-text");
    const container = paragraph.parentElement as HTMLDivElement;
    const textNode = paragraph.firstChild as Text;

    fireEvent.mouseDown(container);
    selectRange(textNode, 5, 5);
    fireEvent.mouseUp(container);
    act(() => {
      vi.advanceTimersByTime(20);
    });

    expect(onSelection).toHaveBeenLastCalledWith(null);
  });
});

describe("createHighlightSpan", () => {
  it("wraps matching text range in a span", () => {
    const container = document.createElement("div");
    container.textContent = "abcdef";

    const span = createHighlightSpan(container, 1, 4, "test-highlight");

    expect(span).not.toBeNull();
    expect(span?.textContent).toBe("bcd");
    expect(container.innerHTML).toContain('<span class="test-highlight">bcd</span>');
  });

  it("returns null when offsets are out of range", () => {
    const container = document.createElement("div");
    container.textContent = "abcdef";

    const span = createHighlightSpan(container, 100, 110, "test-highlight");
    expect(span).toBeNull();
  });
});
