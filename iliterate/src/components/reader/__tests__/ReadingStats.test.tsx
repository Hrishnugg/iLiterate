import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReadingStats } from "../ReadingStats";

function setProgressRect(element: HTMLElement, left = 100, width = 200) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      left,
      top: 0,
      right: left + width,
      bottom: 10,
      width,
      height: 10,
      x: left,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

describe("ReadingStats", () => {
  it("seeks on click and drag with clamped percentages", () => {
    const onSeek = vi.fn();

    render(
      <ReadingStats
        progress={42}
        wordsRead={420}
        totalWords={1000}
        timeRemaining="3 min"
        isInteractive
        onSeek={onSeek}
      />
    );

    const seekArea = screen.getByTitle("Click or drag to seek");
    setProgressRect(seekArea);

    fireEvent.mouseDown(seekArea, { clientX: 150 });
    fireEvent.mouseMove(document, { clientX: 350 });
    fireEvent.mouseMove(document, { clientX: 40 });
    fireEvent.mouseUp(document);
    fireEvent.mouseMove(document, { clientX: 200 });

    expect(onSeek).toHaveBeenNthCalledWith(1, 25);
    expect(onSeek).toHaveBeenNthCalledWith(2, 100);
    expect(onSeek).toHaveBeenNthCalledWith(3, 0);
    expect(onSeek).toHaveBeenCalledTimes(3);
  });

  it("ignores pointer interaction when progress seeking is disabled", () => {
    const onSeek = vi.fn();
    const { container } = render(
      <ReadingStats
        progress={42}
        wordsRead={420}
        totalWords={1000}
        timeRemaining="3 min"
        onSeek={onSeek}
      />
    );

    const seekArea = container.querySelector('[data-slot="progress"]')
      ?.parentElement as HTMLElement | null;

    if (!seekArea) {
      throw new Error("Expected progress seek area");
    }

    setProgressRect(seekArea);
    fireEvent.mouseDown(seekArea, { clientX: 160 });

    expect(screen.queryByTitle("Click or drag to seek")).not.toBeInTheDocument();
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("shows completed copy and badge at 100 percent progress", () => {
    render(
      <ReadingStats
        progress={100}
        wordsRead={1000}
        totalWords={1000}
        timeRemaining="0 min"
      />
    );

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText(/article completed/i)).toBeInTheDocument();
  });
});
