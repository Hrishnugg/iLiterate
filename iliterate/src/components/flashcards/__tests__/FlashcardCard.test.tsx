import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, afterEach } from "vitest";
import { FlashcardCard, type FlashcardData } from "../FlashcardCard";

afterEach(() => vi.restoreAllMocks());

const mockCard: FlashcardData = {
  id: "1",
  ease_factor: 2.5,
  interval_days: 1,
  repetitions: 0,
  next_review_date: new Date().toISOString(),
  times_reviewed: 3,
  times_correct: 2,
  context_sentence: "This is a context hint.",
  vocabulary: {
    id: "v1",
    word: "hola",
    language: "es",
    pronunciation: "o-la",
    definitions: { translation: "hello", definitions: ["hello", "hi"] },
    part_of_speech: "interjection",
  },
  intervalPreview: { again: 1, hard: 2, good: 6, easy: 30 },
};

describe("FlashcardCard", () => {
  it("shows front content and reveals pronunciation and hint", () => {
    const onFlip = vi.fn();
    render(<FlashcardCard card={mockCard} isFlipped={false} onFlip={onFlip} />);

    expect(screen.getAllByText("hola")[0]).toBeInTheDocument();
    expect(screen.getByText("Pronunciation")).toBeInTheDocument();
    expect(screen.getByText("Hint")).toBeInTheDocument();

    // show pronunciation
    fireEvent.click(screen.getByText("Pronunciation"));
    expect(screen.getAllByText("o-la")[0]).toBeInTheDocument();

    // show hint
    fireEvent.click(screen.getByText("Hint"));
    expect(screen.getAllByText(/This is a context hint/)[0]).toBeInTheDocument();

    // clicking Show Answer calls onFlip
    fireEvent.click(screen.getByText(/Show Answer/i));
    expect(onFlip).toHaveBeenCalled();
  });

  it("renders back side when flipped", () => {
    const onFlip = vi.fn();
    render(<FlashcardCard card={mockCard} isFlipped={true} onFlip={onFlip} />);

    // back shows translation and review counts
    expect(screen.getAllByText("hola")[0]).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText(/Reviewed 3 times/)).toBeInTheDocument();
  });
});
