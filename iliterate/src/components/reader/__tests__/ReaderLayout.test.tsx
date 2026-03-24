import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReaderLayout } from "../ReaderLayout";

const back = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back,
  }),
}));

function renderLayout(
  overrides: Partial<ComponentProps<typeof ReaderLayout>> = {}
) {
  return render(
    <ReaderLayout
      title="Sample Article"
      leftSidebar={<div>TOC Sidebar</div>}
      rightSidebar={<div>Notes Sidebar</div>}
      {...overrides}
    >
      <p>Main content</p>
    </ReaderLayout>
  );
}

describe("ReaderLayout", () => {
  beforeEach(() => {
    back.mockReset();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    });
  });

  it("hides the table of contents control when requested", () => {
    renderLayout({ hideLeftSidebar: true });

    expect(screen.queryByTitle("Table of Contents")).not.toBeInTheDocument();
    expect(screen.getByTitle("Notes & Lookups")).toBeInTheDocument();
  });

  it("toggles the audio panel from the toolbar", async () => {
    const user = userEvent.setup();
    renderLayout({ audioPlayer: <div>Audio Controls</div> });

    expect(screen.queryByText("Audio Controls")).not.toBeInTheDocument();

    await user.click(screen.getByTitle("Audio playback"));
    expect(screen.getByText("Audio Controls")).toBeInTheDocument();

    await user.click(screen.getByTitle("Audio playback"));
    await waitFor(() => {
      expect(screen.queryByText("Audio Controls")).not.toBeInTheDocument();
    });
  });

  it("renders the mode panel and hides audio while RSVP mode is active", () => {
    renderLayout({
      audioPlayer: <div>Audio Controls</div>,
      isRSVPMode: true,
      onToggleRSVP: vi.fn(),
      modePanel: <div>Guided Reader Panel</div>,
    });

    expect(screen.getByText("Guided Reader Panel")).toBeInTheDocument();
    expect(screen.queryByTitle("Audio playback")).not.toBeInTheDocument();
  });

  it("calls the RSVP toggle from the toolbar", async () => {
    const user = userEvent.setup();
    const onToggleRSVP = vi.fn();

    renderLayout({
      onToggleRSVP,
    });

    await user.click(screen.getByTitle("RSVP Speed Reader"));

    expect(onToggleRSVP).toHaveBeenCalledTimes(1);
  });

  it("removes the article wrapper in RSVP mode", () => {
    const { container } = renderLayout({
      isRSVPMode: true,
      onToggleRSVP: vi.fn(),
    });

    expect(container.querySelector("article")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Two-page book mode")).not.toBeInTheDocument();
  });
});
