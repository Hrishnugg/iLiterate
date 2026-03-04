import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecentLookupsPanel } from "../RecentLookupsPanel";
import type { TranslationLookup } from "@/types/database";

function makeLookup(id: number, source = `word-${id}`): TranslationLookup {
  return {
    id: `lookup-${id}`,
    user_id: "user-1",
    content_id: "content-1",
    source_text: source,
    translated_text: `translation-${id}`,
    source_lang: "es",
    target_lang: "en",
    transliteration: null,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("RecentLookupsPanel", () => {
  it("shows empty state when there are no lookups", () => {
    render(<RecentLookupsPanel lookups={[]} />);

    expect(screen.getByText("Recent Lookups")).toBeInTheDocument();
    expect(
      screen.getByText("Words and phrases you translate will appear here.")
    ).toBeInTheDocument();
  });

  it("shows total count but renders only the latest 15 entries", () => {
    const lookups = Array.from({ length: 20 }, (_, index) => makeLookup(index + 1));
    render(<RecentLookupsPanel lookups={lookups} />);

    expect(screen.getByText("Recent Lookups (20)")).toBeInTheDocument();
    expect(screen.getByText("word-1")).toBeInTheDocument();
    expect(screen.getByText("word-15")).toBeInTheDocument();
    expect(screen.queryByText("word-16")).not.toBeInTheDocument();
  });

  it("suppresses add button for terms already in flashcards", () => {
    const lookups = [makeLookup(1, "Bonjour"), makeLookup(2, "au revoir")];
    const flashcardTerms = new Set(["bonjour"]);
    const onAddToFlashcards = vi.fn();

    render(
      <RecentLookupsPanel
        lookups={lookups}
        flashcardTerms={flashcardTerms}
        onAddToFlashcards={onAddToFlashcards}
      />
    );

    const firstItem = screen.getByText("Bonjour").closest("div");
    expect(firstItem).not.toBeNull();
    if (firstItem) {
      expect(within(firstItem).queryByRole("button", { name: /add/i })).toBeNull();
    }

    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("handles add and remove actions without triggering lookup click", async () => {
    const user = userEvent.setup();
    const lookup = makeLookup(1, "hola");
    const onLookupClick = vi.fn();
    const onAddToFlashcards = vi.fn();
    const onRemove = vi.fn();
    const { container } = render(
      <RecentLookupsPanel
        lookups={[lookup]}
        onLookupClick={onLookupClick}
        onAddToFlashcards={onAddToFlashcards}
        onRemove={onRemove}
      />
    );

    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onAddToFlashcards).toHaveBeenCalledWith(lookup);
    expect(onLookupClick).not.toHaveBeenCalled();

    const allButtons = container.querySelectorAll("button");
    const removeButton = allButtons[allButtons.length - 1] as HTMLButtonElement;
    await user.click(removeButton);
    expect(onRemove).toHaveBeenCalledWith("lookup-1");
  });
});
