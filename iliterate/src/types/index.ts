export * from "./database";

export interface SpacedRepetitionResult {
  nextReviewDate: Date;
  newEaseFactor: number;
  newInterval: number;
  newRepetitions: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  streakStartDate: Date;
  activityCalendar: Record<string, boolean>;
}
