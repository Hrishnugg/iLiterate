import { describe, it, expect } from "vitest";
import {
  calculateQuizPoints,
  calculatePerfectQuizBonus,
  calculateReadingPoints,
  calculateLessonPoints,
  calculateFlashcardPoints,
  calculateStreakBonus,
} from "../points";

describe("calculateQuizPoints", () => {
  it("returns 0 for 0 score", () => {
    expect(calculateQuizPoints(0, 10)).toBe(0);
  });

  it("returns 20 for perfect score", () => {
    expect(calculateQuizPoints(10, 10)).toBe(20);
  });

  it("returns floor(percentage * 20)", () => {
    expect(calculateQuizPoints(7, 10)).toBe(14); // 0.7 * 20 = 14
    expect(calculateQuizPoints(3, 10)).toBe(6); // 0.3 * 20 = 6
  });

  it("floors fractional results", () => {
    expect(calculateQuizPoints(1, 3)).toBe(6); // floor(0.333 * 20) = 6
  });

  it("returns 0 when maxScore is 0", () => {
    expect(calculateQuizPoints(0, 0)).toBe(0);
  });

  it("returns 0 when maxScore is negative", () => {
    expect(calculateQuizPoints(5, -1)).toBe(0);
  });
});

describe("calculatePerfectQuizBonus", () => {
  it("returns 10 for perfect score with 3+ questions", () => {
    expect(calculatePerfectQuizBonus(5, 5)).toBe(10);
    expect(calculatePerfectQuizBonus(3, 3)).toBe(10);
  });

  it("returns 0 for imperfect score", () => {
    expect(calculatePerfectQuizBonus(4, 5)).toBe(0);
  });

  it("returns 0 for perfect score with fewer than 3 questions", () => {
    expect(calculatePerfectQuizBonus(2, 2)).toBe(0);
    expect(calculatePerfectQuizBonus(1, 1)).toBe(0);
  });
});

describe("calculateReadingPoints", () => {
  it("returns base 10 for 0 words", () => {
    expect(calculateReadingPoints(0)).toBe(10);
  });

  it("adds 1 per 100 words", () => {
    expect(calculateReadingPoints(100)).toBe(11);
    expect(calculateReadingPoints(500)).toBe(15);
    expect(calculateReadingPoints(1000)).toBe(20);
  });

  it("floors partial word counts", () => {
    expect(calculateReadingPoints(150)).toBe(11); // 10 + floor(150/100) = 11
    expect(calculateReadingPoints(99)).toBe(10);
  });
});

describe("calculateLessonPoints", () => {
  it("returns 15 for 0% quiz performance", () => {
    expect(calculateLessonPoints(0)).toBe(15);
  });

  it("returns 25 for 100% quiz performance", () => {
    expect(calculateLessonPoints(1.0)).toBe(25);
  });

  it("calculates correctly for mid-range percentage", () => {
    expect(calculateLessonPoints(0.7)).toBe(22); // 15 + floor(0.7 * 10) = 22
    expect(calculateLessonPoints(0.5)).toBe(20); // 15 + floor(0.5 * 10) = 20
  });
});

describe("calculateFlashcardPoints", () => {
  it("returns 2 for correct", () => {
    expect(calculateFlashcardPoints(true)).toBe(2);
  });

  it("returns 1 for incorrect", () => {
    expect(calculateFlashcardPoints(false)).toBe(1);
  });
});

describe("calculateStreakBonus", () => {
  it("returns streak value for streaks <= 7", () => {
    expect(calculateStreakBonus(1)).toBe(1);
    expect(calculateStreakBonus(5)).toBe(5);
    expect(calculateStreakBonus(7)).toBe(7);
  });

  it("caps at 7 for longer streaks", () => {
    expect(calculateStreakBonus(8)).toBe(7);
    expect(calculateStreakBonus(100)).toBe(7);
  });

  it("returns 0 for 0 streak", () => {
    expect(calculateStreakBonus(0)).toBe(0);
  });
});
