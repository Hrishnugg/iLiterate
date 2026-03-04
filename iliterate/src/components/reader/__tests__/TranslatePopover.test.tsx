import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { TranslatePopover } from "../TranslatePopover";
import type { TextSelection } from "../TextHighlighter";

const baseTranslation = {
  translation: "hello",
  transliteration: "heh-lo",
  partOfSpeech: "interjection",
  definitions: ["used as a greeting"],
};

function createSelection(text = "hola"): TextSelection {
  const range = document.createRange();
  const textNode = document.createTextNode(text);
  const wrapper = document.createElement("div");
  wrapper.appendChild(textNode);
  document.body.appendChild(wrapper);
  range.selectNodeContents(textNode);

  return {
    text,
    startOffset: 5,
    endOffset: 9,
    contextBefore: "say ",
    contextAfter: " to everyone",
    range,
  };
}

function renderPopover(overrides: Partial<ComponentProps<typeof TranslatePopover>> = {}) {
  return render(
    <TranslatePopover
      selection={createSelection()}
      position={{ x: 300, y: 150, bottom: 170 }}
      onTranslate={vi.fn().mockResolvedValue(baseTranslation)}
      onAddNote={vi.fn()}
      onSaveWord={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />
  );
}

describe("TranslatePopover", () => {
  it("translates selected text and displays translation metadata", async () => {
    const user = userEvent.setup();
    const onTranslate = vi.fn().mockResolvedValue(baseTranslation);
    renderPopover({ onTranslate });

    await user.click(screen.getByRole("button", { name: "Translate" }));
    expect(onTranslate).toHaveBeenCalledWith("hola");

    expect(await screen.findByText("hello")).toBeInTheDocument();
    expect(screen.getByText("heh-lo")).toBeInTheDocument();
    expect(screen.getByText("interjection")).toBeInTheDocument();
    expect(screen.getByText("• used as a greeting")).toBeInTheDocument();
  });

  it("saves translated word to flashcards", async () => {
    const user = userEvent.setup();
    const onSaveWord = vi.fn();
    renderPopover({ onSaveWord });

    await user.click(screen.getByRole("button", { name: "Translate" }));
    await screen.findByText("hello");

    await user.click(screen.getByRole("button", { name: "Save Word" }));
    expect(onSaveWord).toHaveBeenCalledWith("hola", baseTranslation);
  });

  it("saves note with translation and optionally skips flashcard creation", async () => {
    const user = userEvent.setup();
    const onAddNote = vi.fn();
    const onSaveWord = vi.fn();
    const onClose = vi.fn();
    renderPopover({ onAddNote, onSaveWord, onClose });

    await user.click(screen.getByRole("button", { name: "Translate" }));
    await screen.findByText("hello");
    await user.click(screen.getByRole("button", { name: "Add Note" }));

    const checkbox = screen.getByRole("checkbox", { name: "Also add to flashcards" });
    await user.click(checkbox);
    await user.type(screen.getByPlaceholderText("Add a note about this..."), "Remember this greeting");
    await user.click(screen.getByRole("button", { name: "Save Note" }));

    expect(onAddNote).toHaveBeenCalledWith("hola", "Remember this greeting", baseTranslation);
    expect(onSaveWord).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("supports note-only flow without translation", async () => {
    const user = userEvent.setup();
    const onAddNote = vi.fn();
    const onClose = vi.fn();
    renderPopover({ onAddNote, onClose });

    await user.click(screen.getByRole("button", { name: "Note" }));
    await user.type(screen.getByPlaceholderText("Add a note about this..."), "Need to revisit later");
    await user.click(screen.getByRole("button", { name: "Save Note" }));

    expect(onAddNote).toHaveBeenCalledWith("hola", "Need to revisit later", undefined);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderPopover({ onClose });

    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
