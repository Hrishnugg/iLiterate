import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { YourNotesPanel } from "../YourNotesPanel";
import type { Highlight } from "@/types/database";

function makeHighlight(
  id: string,
  overrides: Partial<Highlight> = {}
): Highlight {
  return {
    id,
    user_id: "user-1",
    content_id: "content-1",
    position_type: "offset",
    start_position: "100",
    end_position: "110",
    selected_text: `selected-${id}`,
    context_before: "before",
    context_after: "after",
    note: null,
    translation: null,
    transliteration: null,
    part_of_speech: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("YourNotesPanel", () => {
  it("shows empty state when there are no notes or translations", () => {
    const highlights = [makeHighlight("a"), makeHighlight("b")];
    render(<YourNotesPanel highlights={highlights} />);

    expect(screen.getByText("Your Notes")).toBeInTheDocument();
    expect(
      screen.getByText("Select text and add notes or translations. They'll appear here.")
    ).toBeInTheDocument();
  });

  it("renders only highlights that have note or translation", () => {
    const highlights = [
      makeHighlight("a", { note: "Important context" }),
      makeHighlight("b"),
      makeHighlight("c", { translation: "translated phrase" }),
    ];

    render(<YourNotesPanel highlights={highlights} />);

    expect(screen.getByText("Your Notes (2)")).toBeInTheDocument();
    expect(screen.getByText("Important context")).toBeInTheDocument();
    expect(screen.getByText("→ translated phrase")).toBeInTheDocument();
    expect(screen.queryByText("selected-b")).not.toBeInTheDocument();
  });

  it("groups nearby notes and separates distant note groups", () => {
    const highlights = [
      makeHighlight("a", { note: "First", start_position: "100" }),
      makeHighlight("b", { note: "Second", start_position: "450" }),
      makeHighlight("c", { note: "Third", start_position: "1200" }),
    ];
    const { container } = render(<YourNotesPanel highlights={highlights} />);

    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("Third")).toBeInTheDocument();

    const separators = container.querySelectorAll(".border-t");
    expect(separators).toHaveLength(1);
  });

  it("handles highlight focus click and delete actions independently", async () => {
    const user = userEvent.setup();
    const onHighlightClick = vi.fn();
    const onDeleteHighlight = vi.fn();
    const highlight = makeHighlight("focus", {
      note: "Click target",
      translation: "focus translation",
    });

    const { container } = render(
      <YourNotesPanel
        highlights={[highlight]}
        focusedHighlightId="focus"
        onHighlightClick={onHighlightClick}
        onDeleteHighlight={onDeleteHighlight}
      />
    );

    const selectionText = screen.getByText(/selected-focus/i);
    const noteButton = selectionText.closest("button");
    expect(noteButton).not.toBeNull();
    if (!noteButton) {
      throw new Error("Expected note button to exist");
    }
    await user.click(noteButton);
    expect(onHighlightClick).toHaveBeenCalledWith(highlight);

    const deleteButton = screen.getByRole("button", { name: "Delete highlight" });
    await user.click(deleteButton);
    expect(onDeleteHighlight).toHaveBeenCalledWith("focus");

    const card = container.querySelector("[data-sidebar-highlight='focus'] .rounded-md");
    expect(card).toHaveClass("ring-2");
  });
});
