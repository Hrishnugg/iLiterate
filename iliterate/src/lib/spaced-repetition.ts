/**
 * SM-2 Spaced Repetition Algorithm Implementation
 *
 * Based on the SuperMemo SM-2 algorithm used by Anki.
 *
 * Key concepts:
 * - Ease Factor: Multiplier for intervals (min 1.3, default 2.5)
 * - Interval: Days until next review
 * - Repetitions: Successful reviews in a row
 */

export type ResponseQuality = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewResult {
  newEaseFactor: number;
  newInterval: number;
  newRepetitions: number;
  nextReviewDate: Date;
}

export interface IntervalPreview {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

// Minimum ease factor to prevent cards from becoming too difficult
const MIN_EASE_FACTOR = 1.3;

// Default ease factor for new cards
export const DEFAULT_EASE_FACTOR = 2.5;

// Easy bonus multiplier
const EASY_BONUS = 1.3;

// Hard interval multiplier
const HARD_MULTIPLIER = 1.2;

/**
 * Calculate the next review state based on user response
 */
export function calculateNextReview(
  currentEase: number,
  currentInterval: number,
  repetitions: number,
  response: ResponseQuality
): ReviewResult {
  let newEase = currentEase;
  let newInterval: number;
  let newRepetitions = repetitions;

  switch (response) {
    case 'again':
      // Failed to recall - reset progress
      newEase = Math.max(MIN_EASE_FACTOR, currentEase - 0.2);
      newInterval = 1;
      newRepetitions = 0;
      break;

    case 'hard':
      // Recalled with difficulty
      newEase = Math.max(MIN_EASE_FACTOR, currentEase - 0.15);
      newInterval = Math.max(1, Math.round(currentInterval * HARD_MULTIPLIER));
      // Don't increment repetitions on hard
      break;

    case 'good':
      // Normal recall
      if (repetitions === 0) {
        newInterval = 1;
      } else if (repetitions === 1) {
        newInterval = 6;
      } else {
        newInterval = Math.round(currentInterval * currentEase);
      }
      newRepetitions = repetitions + 1;
      break;

    case 'easy':
      // Easy recall - bonus interval
      if (repetitions === 0) {
        newInterval = 4; // Skip ahead for easy new cards
      } else if (repetitions === 1) {
        newInterval = Math.round(6 * EASY_BONUS);
      } else {
        newInterval = Math.round(currentInterval * currentEase * EASY_BONUS);
      }
      newEase = currentEase + 0.15;
      newRepetitions = repetitions + 1;
      break;
  }

  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  return {
    newEaseFactor: Math.round(newEase * 100) / 100, // Round to 2 decimal places
    newInterval,
    newRepetitions,
    nextReviewDate,
  };
}

/**
 * Preview what intervals each response would give
 * Used to show users the consequences of each button
 */
export function calculateIntervalPreview(
  currentEase: number,
  currentInterval: number,
  repetitions: number
): IntervalPreview {
  return {
    again: calculateNextReview(currentEase, currentInterval, repetitions, 'again').newInterval,
    hard: calculateNextReview(currentEase, currentInterval, repetitions, 'hard').newInterval,
    good: calculateNextReview(currentEase, currentInterval, repetitions, 'good').newInterval,
    easy: calculateNextReview(currentEase, currentInterval, repetitions, 'easy').newInterval,
  };
}

/**
 * Format interval for display (e.g., "1d", "2w", "3mo")
 */
export function formatInterval(days: number): string {
  if (days < 1) {
    return '<1d';
  } else if (days === 1) {
    return '1d';
  } else if (days < 7) {
    return `${days}d`;
  } else if (days < 30) {
    const weeks = Math.round(days / 7);
    return `${weeks}w`;
  } else if (days < 365) {
    const months = Math.round(days / 30);
    return `${months}mo`;
  } else {
    const years = Math.round(days / 365 * 10) / 10;
    return `${years}y`;
  }
}

/**
 * Check if a card is due for review
 */
export function isCardDue(nextReviewDate: string | Date): boolean {
  const reviewDate = new Date(nextReviewDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  reviewDate.setHours(0, 0, 0, 0);
  return reviewDate <= today;
}

/**
 * Calculate days until next review (negative if overdue)
 */
export function daysUntilReview(nextReviewDate: string | Date): number {
  const reviewDate = new Date(nextReviewDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  reviewDate.setHours(0, 0, 0, 0);
  const diffTime = reviewDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
