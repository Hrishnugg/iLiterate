import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { ReaderLayout } from "../ReaderLayout";

function renderLayout(overrides: Partial<ComponentProps<typeof ReaderLayout>> = {}) {
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
  it("hides left sidebar entirely when requested", () => {
    renderLayout({ hideLeftSidebar: true });

    expect(screen.queryByText("TOC Sidebar")).not.toBeInTheDocument();
    expect(screen.getByText("Notes Sidebar")).toBeInTheDocument();
  });

  it("toggles left sidebar visibility from toolbar", async () => {
    const user = userEvent.setup();
    const { container } = renderLayout();
    const asides = container.querySelectorAll("aside");
    const leftAside = asides[0];

    expect(leftAside).toHaveClass("w-64");

    await user.click(screen.getByTitle("Toggle table of contents"));

    expect(leftAside).toHaveClass("w-0");
  });

  it("toggles audio bar visibility", async () => {
    const user = userEvent.setup();
    renderLayout({ audioPlayer: <div>Audio Controls</div> });

    const audioToggle = screen.getByTitle("Audio playback");
    expect(screen.queryByText("Audio Controls")).not.toBeInTheDocument();

    await user.click(audioToggle);
    expect(screen.getByText("Audio Controls")).toBeInTheDocument();

    await user.click(audioToggle);
    expect(screen.queryByText("Audio Controls")).not.toBeInTheDocument();
  });

  it("reopens right sidebar when requestRightOpen changes", async () => {
    const user = userEvent.setup();
    const { container, rerender } = renderLayout();

    let asides = container.querySelectorAll("aside");
    const rightAside = asides[1];

    await user.click(screen.getByTitle("Toggle notes sidebar"));
    expect(rightAside).toHaveClass("w-0");

    rerender(
      <ReaderLayout
        title="Sample Article"
        leftSidebar={<div>TOC Sidebar</div>}
        rightSidebar={<div>Notes Sidebar</div>}
        requestRightOpen="highlight-1"
      >
        <p>Main content</p>
      </ReaderLayout>
    );

    asides = container.querySelectorAll("aside");
    await waitFor(() => {
      expect(asides[1]).toHaveClass("w-80");
    });
  });

  it("switches wrapper behavior for RSVP mode and calls toggle", async () => {
    const onToggleRSVP = vi.fn();
    const user = userEvent.setup();
    const { container, rerender } = renderLayout({ onToggleRSVP });

    expect(container.querySelector("article")).toBeInTheDocument();

    const rsvpButton = screen.getByTitle("RSVP Speed Reader");
    await user.click(rsvpButton);
    expect(onToggleRSVP).toHaveBeenCalledTimes(1);

    rerender(
      <ReaderLayout
        title="Sample Article"
        leftSidebar={<div>TOC Sidebar</div>}
        rightSidebar={<div>Notes Sidebar</div>}
        onToggleRSVP={onToggleRSVP}
        isRSVPMode
      >
        <p>Main content</p>
      </ReaderLayout>
    );

    expect(container.querySelector("article")).not.toBeInTheDocument();
  });
});
