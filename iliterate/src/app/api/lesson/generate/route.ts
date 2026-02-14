import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  generateLesson,
  LessonLength,
  suggestTopic,
  getTopicInfo,
  LESSON_TOPICS,
} from "@/lib/lesson-generator";

// Validation schema
const generateLessonSchema = z.object({
  topic: z.string().optional(),
  length: z.enum(["short", "medium", "long"]).default("medium"),
  useSuggestedTopic: z.boolean().default(true),
});

/**
 * POST /api/lesson/generate - Generate a new lesson for the user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const validationResult = generateLessonSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { topic: requestedTopic, length, useSuggestedTopic } = validationResult.data;

    // Get user's profile for language and motivations
    const { data: profile } = await supabase
      .from("profiles")
      .select("target_language, native_language, learning_motivation")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found. Please complete onboarding." },
        { status: 400 }
      );
    }

    // Get user's current skill level
    const { data: skillLevels } = await supabase
      .from("user_skill_levels")
      .select("reading_level")
      .eq("user_id", user.id)
      .single();

    const targetLevel = skillLevels?.reading_level || 1;

    // Determine topic
    let topic: string;
    if (requestedTopic) {
      topic = requestedTopic;
    } else if (useSuggestedTopic && profile.learning_motivation?.length > 0) {
      topic = suggestTopic(profile.learning_motivation);
    } else {
      // Random topic
      topic = LESSON_TOPICS[Math.floor(Math.random() * LESSON_TOPICS.length)].id;
    }

    const topicInfo = getTopicInfo(topic);

    // Generate the lesson content
    const lessonContent = await generateLesson({
      targetLevel,
      language: profile.target_language,
      nativeLanguage: profile.native_language,
      topic: topicInfo.name,
      length: length as LessonLength,
    });

    // Save to database
    const { data: lesson, error: insertError } = await supabase
      .from("lesson_sessions")
      .insert({
        user_id: user.id,
        title: lessonContent.title,
        content_body: lessonContent.body,
        target_level: targetLevel,
        topic: topic,
        length_type: length,
        word_count: lessonContent.wordCount,
        vocabulary: lessonContent.vocabulary,
        status: "reading",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to save lesson:", insertError);
      return NextResponse.json(
        { error: "Failed to save lesson" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        body: lesson.content_body,
        targetLevel: lesson.target_level,
        topic: topicInfo,
        length: lesson.length_type,
        wordCount: lesson.word_count,
        vocabulary: lesson.vocabulary,
        status: lesson.status,
        createdAt: lesson.created_at,
      },
    });
  } catch (error) {
    console.error("Generate lesson error:", error);
    return NextResponse.json(
      { error: "Failed to generate lesson" },
      { status: 500 }
    );
  }
}
