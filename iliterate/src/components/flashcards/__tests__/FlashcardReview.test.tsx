import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, afterEach } from "vitest";
import { FlashcardReview } from "../FlashcardReview";

afterEach(() => vi.restoreAllMocks());

describe("FlashcardReview minimal flows", () => {
  it("shows 'All caught up' when there are no cards", async () => {
    const mockState = {
      cards: [],
      totalDue: 0,
      limitReached: false,
      dailyReviewsUsed: 0,
      dailyLimit: 10,
      remainingReviews: 10,
      isPremium: false,
    };

    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockState,
    });

    const onClose = vi.fn();
    render(<FlashcardReview onClose={onClose} />);

    await waitFor(() => expect(screen.getByText(/All caught up!/i)).toBeInTheDocument());

    fireEvent.click(screen.getByText(/Done/i));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows upgrade prompt when limitReached is true and allows closing", async () => {
    const mockState = {
      cards: [],
      totalDue: 0,
      limitReached: true,
      dailyReviewsUsed: 5,
      dailyLimit: 5,
      remainingReviews: 0,
      isPremium: false,
    };

    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockState,
    });

    const onClose = vi.fn();
    render(<FlashcardReview onClose={onClose} />);

    await waitFor(() => expect(screen.getByText(/Daily Limit Reached/i)).toBeInTheDocument());

    fireEvent.click(screen.getByText(/Done for Today/i));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error state when fetch fails", async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: false });

    const onClose = vi.fn();
    render(<FlashcardReview onClose={onClose} />);

    await waitFor(() => expect(screen.getByText(/Failed to fetch cards/i)).toBeInTheDocument());

    // Close via Close button
    fireEvent.click(screen.getByText(/Close/i));
    expect(onClose).toHaveBeenCalled();
  });
});
