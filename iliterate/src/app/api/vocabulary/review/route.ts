import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  calculateNextReview,
  calculateIntervalPreview,
  ResponseQuality,
} from "@/lib/spaced-repetition";
import { awardPoints, calculateFlashcardPoints, hasFlashcardPointsToday } from "@/lib/points";

const FREE_DAILY_LIMIT = 10;

// Schema for POST request
const reviewSchema = z.object({
  cardId: z.string().uuid(),
  response: z.enum(["again", "hard", "good", "easy"]),
});

/**
 * GET /api/vocabulary/review - Get cards due for review
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile for premium status and daily limit
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_premium, daily_reviews_used, last_review_date")
      .eq("id", user.id)
      .single();

    const isPremium = profile?.is_premium ?? false;
    const today = new Date().toISOString().split("T")[0];

    // Reset daily count if it's a new day
    let dailyReviewsUsed = profile?.daily_reviews_used ?? 0;
    if (profile?.last_review_date !== today) {
      dailyReviewsUsed = 0;
      // Update the profile to reset the counter
      await supabase
        .from("profiles")
        .update({ daily_reviews_used: 0, last_review_date: today })
        .eq("id", user.id);
    }

    // Check if free user has reached limit
    const limitReached = !isPremium && dailyReviewsUsed >= FREE_DAILY_LIMIT;
    const remainingReviews = isPremium
      ? Infinity
      : Math.max(0, FREE_DAILY_LIMIT - dailyReviewsUsed);

    if (limitReached) {
      return NextResponse.json({
        cards: [],
        limitReached: true,
        dailyReviewsUsed,
        dailyLimit: FREE_DAILY_LIMIT,
        remainingReviews: 0,
        isPremium,
      });
    }

    // Get due cards
    const { data: cards, error: cardsError } = await supabase
      .from("user_vocabulary")
      .select(`
        id,
        ease_factor,
        interval_days,
        repetitions,
        next_review_date,
        times_reviewed,
        times_correct,
        context_sentence,
        vocabulary:vocabulary_id (
          id,
          word,
          language,
          pronunciation,
          definitions,
          part_of_speech
        )
      `)
      .eq("user_id", user.id)
      .lte("next_review_date", today)
      .order("next_review_date", { ascending: true });

    if (cardsError) {
      console.error("Failed to fetch cards:", cardsError);
      return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 });
    }

    // For free users, limit the number of cards returned
    const cardsToReturn = isPremium
      ? cards
      : cards?.slice(0, remainingReviews) ?? [];

    // Add interval previews to each card
    const cardsWithPreviews = cardsToReturn.map((card) => ({
      ...card,
      intervalPreview: calculateIntervalPreview(
        card.ease_factor,
        card.interval_days,
        card.repetitions
      ),
    }));

    return NextResponse.json({
      cards: cardsWithPreviews,
      totalDue: cards?.length ?? 0,
      limitReached: false,
      dailyReviewsUsed,
      dailyLimit: FREE_DAILY_LIMIT,
      remainingReviews: isPremium ? cards?.length ?? 0 : remainingReviews,
      isPremium,
    });
  } catch (error) {
    console.error("Get review cards error:", error);
    return NextResponse.json(
      { error: "Failed to get review cards" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vocabulary/review - Submit a review result
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = reviewSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { cardId, response } = validation.data;

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_premium, daily_reviews_used, last_review_date")
      .eq("id", user.id)
      .single();

    const isPremium = profile?.is_premium ?? false;
    const today = new Date().toISOString().split("T")[0];

    // Check daily limit for free users
    let dailyReviewsUsed = profile?.daily_reviews_used ?? 0;
    if (profile?.last_review_date !== today) {
      dailyReviewsUsed = 0;
    }

    if (!isPremium && dailyReviewsUsed >= FREE_DAILY_LIMIT) {
      return NextResponse.json({
        error: "Daily review limit reached",
        limitReached: true,
      }, { status: 403 });
    }

    // Get the card
    const { data: card, error: cardError } = await supabase
      .from("user_vocabulary")
      .select("*")
      .eq("id", cardId)
      .eq("user_id", user.id)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // Calculate new review state
    const result = calculateNextReview(
      card.ease_factor,
      card.interval_days,
      card.repetitions,
      response as ResponseQuality
    );

    // Update the card
    const { error: updateError } = await supabase
      .from("user_vocabulary")
      .update({
        ease_factor: result.newEaseFactor,
        interval_days: result.newInterval,
        repetitions: result.newRepetitions,
        next_review_date: result.nextReviewDate.toISOString().split("T")[0],
        times_reviewed: card.times_reviewed + 1,
        times_correct: response !== "again" ? card.times_correct + 1 : card.times_correct,
        last_reviewed_at: new Date().toISOString(),
      })
      .eq("id", cardId);

    if (updateError) {
      console.error("Failed to update card:", updateError);
      return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
    }

    // Award leaderboard points (one per card per day)
    const alreadyAwarded = await hasFlashcardPointsToday(supabase, user.id, cardId);
    if (!alreadyAwarded) {
      const isCorrect = response !== "again";
      const pts = calculateFlashcardPoints(isCorrect);
      await awardPoints(supabase, user.id, pts, "flashcard_review", cardId, {
        response,
      });
    }

    // Update daily review count
    const newDailyCount = dailyReviewsUsed + 1;
    await supabase
      .from("profiles")
      .update({
        daily_reviews_used: newDailyCount,
        last_review_date: today,
      })
      .eq("id", user.id);

    const remainingReviews = isPremium
      ? Infinity
      : Math.max(0, FREE_DAILY_LIMIT - newDailyCount);

    return NextResponse.json({
      success: true,
      newInterval: result.newInterval,
      nextReviewDate: result.nextReviewDate.toISOString().split("T")[0],
      dailyReviewsUsed: newDailyCount,
      remainingReviews,
      limitReached: !isPremium && newDailyCount >= FREE_DAILY_LIMIT,
    });
  } catch (error) {
    console.error("Submit review error:", error);
    return NextResponse.json(
      { error: "Failed to submit review" },
      { status: 500 }
    );
  }
}
