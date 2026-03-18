import { SupabaseClient } from "@supabase/supabase-js";

export type PointSource =
  | "quiz_completion"
  | "reading_completion"
  | "lesson_completion"
  | "flashcard_review"
  | "streak_bonus"
  | "perfect_quiz";

/**
 * Quiz completion: floor(percentage * 20) → 0-20 pts
 */
export function calculateQuizPoints(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  const percentage = score / maxScore;
  return Math.floor(percentage * 20);
}

/**
 * Perfect quiz bonus: +10 if 100% and at least 3 questions
 */
export function calculatePerfectQuizBonus(
  score: number,
  maxScore: number
): number {
  if (maxScore >= 3 && score === maxScore) return 10;
  return 0;
}

/**
 * Reading completion (>=95%): 10 + floor(wordCount / 100)
 */
export function calculateReadingPoints(wordCount: number): number {
  return 10 + Math.floor(wordCount / 100);
}

/**
 * Lesson completion: 15 + floor(quizPercentage * 10)
 */
export function calculateLessonPoints(quizPercentage: number): number {
  return 15 + Math.floor(quizPercentage * 10);
}

/**
 * Flashcard review: 2 (correct) / 1 (incorrect)
 */
export function calculateFlashcardPoints(isCorrect: boolean): number {
  return isCorrect ? 2 : 1;
}

/**
 * Streak bonus: min(currentStreak, 7)
 */
export function calculateStreakBonus(currentStreak: number): number {
  return Math.min(currentStreak, 7);
}

/**
 * Insert a point event into the database
 */
export async function awardPoints(
  supabase: SupabaseClient,
  userId: string,
  points: number,
  source: PointSource,
  sourceId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (points <= 0) return;

  const { error } = await supabase.from("point_events").insert({
    user_id: userId,
    points,
    source,
    source_id: sourceId ?? null,
    metadata: metadata ?? {},
  });

  if (error) {
    console.error("Failed to award points:", error);
  }
}

/**
 * Check if flashcard points were already awarded for this card today.
 * Anti-gaming: one award per card per day.
 */
export async function hasFlashcardPointsToday(
  supabase: SupabaseClient,
  userId: string,
  cardId: string
): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("point_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", "flashcard_review")
    .eq("source_id", cardId)
    .gte("created_at", today.toISOString());

  return (count ?? 0) > 0;
}
