import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, afterEach } from "vitest";
import { Deck } from "../Deck";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockFetchResponse(body: unknown, init?: ResponseInit) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
        ...init,
      })
    )
  );
}

describe("Deck component", () => {
  const mockCards = [
    {
      id: "1",
      context_sentence: "This is a sample sentence.",
      vocabulary: {
        word: "hola",
        pronunciation: "o-la",
        definitions: { translation: "hello" },
        part_of_speech: "interjection",
      },
    },
    {
      id: "2",
      context_sentence: null,
      vocabulary: {
        word: "adios",
        pronunciation: null,
        definitions: { definitions: ["goodbye"] },
        part_of_speech: null,
      },
    },
  ];

  it("renders empty state when API returns no cards", async () => {
    mockFetchResponse([]);

    render(<Deck contentId="book1" />);

    await waitFor(() => {
      expect(screen.getByText(/No flashcards found/i)).toBeInTheDocument();
    });
  });

  it("renders error state when fetch fails", async () => {
    mockFetchResponse({ error: "Failed to fetch vocabulary" }, { status: 500 });

    render(<Deck contentId="book2" />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch vocabulary/i)).toBeInTheDocument();
    });
  });

  it("renders cards, flips on click, and navigates between cards", async () => {
    mockFetchResponse(mockCards);

    render(<Deck contentId="book3" contentTitle="My Book" />);

    // wait for first card to render (front/back both contain the word)
    await waitFor(() => expect(screen.getAllByText("hola").length).toBeGreaterThanOrEqual(1));

    // contentTitle rendered
    expect(screen.getByText("My Book")).toBeInTheDocument();

    // front shows word and pronunciation (both front and back contain text)
    expect(screen.getAllByText("hola")[0]).toBeInTheDocument();
    expect(screen.getAllByText("o-la")[0]).toBeInTheDocument();

    // click to flip (first role=button is the card flip area)
    const cardButton = screen.getAllByRole("button")[0];
    fireEvent.click(cardButton);

    // back should show translation
    await waitFor(() => expect(screen.getByText("hello")).toBeInTheDocument());

    // navigate next using the navigation buttons
    const buttons = screen.getAllByRole("button");
    const navNext = buttons[2];
    fireEvent.click(navNext);

    // second card word (front/back both contain the text)
    await waitFor(() => expect(screen.getAllByText("adios")[0]).toBeInTheDocument());

    // flip second card and show fallback translation from definitions array
    fireEvent.click(cardButton);
    await waitFor(() => expect(screen.getByText("goodbye")).toBeInTheDocument());
  });
});
