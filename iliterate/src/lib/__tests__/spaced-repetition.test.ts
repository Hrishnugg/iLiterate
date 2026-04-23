/**
 * @fileoverview
 * Regression and boundary tests for the SM-2 spaced repetition module.
 *
 * Testing strategy:
 * 1. Unit tests around branch-heavy response handling (again/hard/good/easy)
 * 2. Regression tests for stable interval progression behavior
 * 3. Mutation-resistant assertions on constants and date logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateNextReview,
  calculateIntervalPreview,
  formatInterval,
  isCardDue,
  daysUntilReview,
  DEFAULT_EASE_FACTOR,
} from "../spaced-repetition";

// ---------------------------------------------------------------------------
// calculateNextReview
// ---------------------------------------------------------------------------
describe("calculateNextReview", () => {
  // ---- "again" response ----
  describe("response: again", () => {
    it("resets repetitions to 0", () => {
      const result = calculateNextReview(2.5, 10, 5, "again");
      expect(result.newRepetitions).toBe(0);
    });

    it("sets interval to 1 day", () => {
      const result = calculateNextReview(2.5, 30, 3, "again");
      expect(result.newInterval).toBe(1);
    });

    it("decreases ease factor by 0.2", () => {
      const result = calculateNextReview(2.5, 10, 3, "again");
      expect(result.newEaseFactor).toBe(2.3);
    });

    it("clamps ease factor to minimum 1.3", () => {
      const result = calculateNextReview(1.4, 10, 3, "again");
      expect(result.newEaseFactor).toBe(1.3);
    });

    it("does not go below 1.3 even from exactly 1.3", () => {
      const result = calculateNextReview(1.3, 10, 3, "again");
      expect(result.newEaseFactor).toBe(1.3);
    });
  });

  // ---- "hard" response ----
  describe("response: hard", () => {
    it("decreases ease factor by 0.15", () => {
      const result = calculateNextReview(2.5, 10, 3, "hard");
      expect(result.newEaseFactor).toBe(2.35);
    });

    it("multiplies interval by 1.2 (hard multiplier)", () => {
      const result = calculateNextReview(2.5, 10, 3, "hard");
      expect(result.newInterval).toBe(12); // round(10 * 1.2) = 12
    });

    it("does not let interval fall below 1", () => {
      const result = calculateNextReview(2.5, 0, 0, "hard");
      expect(result.newInterval).toBe(1);
    });

    it("does not increment repetitions", () => {
      const result = calculateNextReview(2.5, 10, 5, "hard");
      expect(result.newRepetitions).toBe(5);
    });

    it("clamps ease factor to minimum 1.3", () => {
      const result = calculateNextReview(1.35, 5, 2, "hard");
      expect(result.newEaseFactor).toBe(1.3);
    });
  });

  // ---- "good" response ----
  describe("response: good", () => {
    it("sets interval to 1 on first review (rep=0)", () => {
      const result = calculateNextReview(2.5, 0, 0, "good");
      expect(result.newInterval).toBe(1);
    });

    it("sets interval to 6 on second review (rep=1)", () => {
      const result = calculateNextReview(2.5, 1, 1, "good");
      expect(result.newInterval).toBe(6);
    });

    it("multiplies interval by ease factor for rep>=2", () => {
      const result = calculateNextReview(2.5, 6, 2, "good");
      expect(result.newInterval).toBe(15); // round(6 * 2.5) = 15
    });

    it("increments repetitions", () => {
      const result = calculateNextReview(2.5, 6, 2, "good");
      expect(result.newRepetitions).toBe(3);
    });

    it("does not change ease factor", () => {
      const result = calculateNextReview(2.5, 6, 2, "good");
      expect(result.newEaseFactor).toBe(2.5);
    });
  });

  // ---- "easy" response ----
  describe("response: easy", () => {
    it("sets interval to 4 on first review (rep=0)", () => {
      const result = calculateNextReview(2.5, 0, 0, "easy");
      expect(result.newInterval).toBe(4);
    });

    it("sets interval to round(6 * 1.3) = 8 on second review (rep=1)", () => {
      const result = calculateNextReview(2.5, 1, 1, "easy");
      expect(result.newInterval).toBe(8); // round(6 * 1.3) = 7.8 → 8
    });

    it("multiplies interval by ease * EASY_BONUS for rep>=2", () => {
      const result = calculateNextReview(2.5, 6, 2, "easy");
      // round(6 * 2.5 * 1.3) = round(19.5) = 20
      expect(result.newInterval).toBe(20);
    });

    it("increases ease factor by 0.15", () => {
      const result = calculateNextReview(2.5, 6, 2, "easy");
      expect(result.newEaseFactor).toBe(2.65);
    });

    it("increments repetitions", () => {
      const result = calculateNextReview(2.5, 6, 2, "easy");
      expect(result.newRepetitions).toBe(3);
    });
  });

  // ---- nextReviewDate ----
  it("sets nextReviewDate to today + newInterval days", () => {
    const now = new Date("2024-06-15T12:00:00Z");
    vi.useFakeTimers({ now });

    const result = calculateNextReview(2.5, 6, 2, "good");
    const expected = new Date("2024-06-15T12:00:00Z");
    expected.setDate(expected.getDate() + result.newInterval);
    expect(result.nextReviewDate.toDateString()).toBe(expected.toDateString());

    vi.useRealTimers();
  });

  // ---- Regression: full progression sequence ----
  it("tracks a realistic learning sequence (regression)", () => {
    // New card: good → good → good → good
    const r1 = calculateNextReview(2.5, 0, 0, "good");
    expect(r1).toMatchObject({ newInterval: 1, newRepetitions: 1, newEaseFactor: 2.5 });

    const r2 = calculateNextReview(r1.newEaseFactor, r1.newInterval, r1.newRepetitions, "good");
    expect(r2).toMatchObject({ newInterval: 6, newRepetitions: 2, newEaseFactor: 2.5 });

    const r3 = calculateNextReview(r2.newEaseFactor, r2.newInterval, r2.newRepetitions, "good");
    expect(r3).toMatchObject({ newInterval: 15, newRepetitions: 3, newEaseFactor: 2.5 });

    const r4 = calculateNextReview(r3.newEaseFactor, r3.newInterval, r3.newRepetitions, "good");
    expect(r4).toMatchObject({ newInterval: 38, newRepetitions: 4, newEaseFactor: 2.5 });
  });
});

// ---------------------------------------------------------------------------
// calculateIntervalPreview
// ---------------------------------------------------------------------------
describe("calculateIntervalPreview", () => {
  it("returns intervals for all four responses", () => {
    const preview = calculateIntervalPreview(2.5, 6, 2);
    expect(preview).toEqual({
      again: 1,
      hard: 7, // round(6 * 1.2) = 7.2 → 7
      good: 15, // round(6 * 2.5)
      easy: 20, // round(6 * 2.5 * 1.3)
    });
  });

  it("handles new card (rep=0)", () => {
    const preview = calculateIntervalPreview(2.5, 0, 0);
    expect(preview).toEqual({ again: 1, hard: 1, good: 1, easy: 4 });
  });
});

// ---------------------------------------------------------------------------
// formatInterval
// ---------------------------------------------------------------------------
describe("formatInterval", () => {
  it("returns '<1d' for sub-day values", () => {
    expect(formatInterval(0)).toBe("<1d");
    expect(formatInterval(0.5)).toBe("<1d");
  });

  it("returns '1d' for exactly 1", () => {
    expect(formatInterval(1)).toBe("1d");
  });

  it("returns days for 2-6", () => {
    expect(formatInterval(3)).toBe("3d");
    expect(formatInterval(6)).toBe("6d");
  });

  it("returns weeks for 7-29", () => {
    expect(formatInterval(7)).toBe("1w");
    expect(formatInterval(14)).toBe("2w");
    expect(formatInterval(21)).toBe("3w");
  });

  it("returns months for 30-364", () => {
    expect(formatInterval(30)).toBe("1mo");
    expect(formatInterval(90)).toBe("3mo");
    expect(formatInterval(180)).toBe("6mo");
  });

  it("returns years for 365+", () => {
    expect(formatInterval(365)).toBe("1y");
    expect(formatInterval(730)).toBe("2y");
    expect(formatInterval(547)).toBe("1.5y");
  });
});

// ---------------------------------------------------------------------------
// isCardDue
// ---------------------------------------------------------------------------
describe("isCardDue", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2024-06-15T12:00:00Z") });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true if review date is today", () => {
    const today = new Date("2024-06-15T12:00:00Z");
    expect(isCardDue(today)).toBe(true);
  });

  it("returns true if review date is in the past", () => {
    const past = new Date("2024-06-10T00:00:00Z");
    expect(isCardDue(past)).toBe(true);
  });

  it("returns false if review date is in the future", () => {
    const future = new Date("2024-06-20T00:00:00Z");
    expect(isCardDue(future)).toBe(false);
  });

  it("accepts Date objects", () => {
    expect(isCardDue(new Date("2024-06-14T00:00:00Z"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// daysUntilReview
// ---------------------------------------------------------------------------
describe("daysUntilReview", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2024-06-15T12:00:00Z") });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 for today", () => {
    const today = new Date("2024-06-15T12:00:00Z");
    expect(daysUntilReview(today)).toBe(0);
  });

  it("returns positive for future dates", () => {
    const future = new Date("2024-06-20T12:00:00Z");
    expect(daysUntilReview(future)).toBe(5);
  });

  it("returns negative for past dates", () => {
    const past = new Date("2024-06-10T12:00:00Z");
    expect(daysUntilReview(past)).toBe(-5);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_EASE_FACTOR constant
// ---------------------------------------------------------------------------
describe("DEFAULT_EASE_FACTOR", () => {
  it("is 2.5 (standard SM-2 default)", () => {
    expect(DEFAULT_EASE_FACTOR).toBe(2.5);
  });
});
