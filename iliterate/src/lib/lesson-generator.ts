/**
 * @module lesson-generator
 * Generates AI-powered reading lessons for language learners using OpenAI GPT-4o-mini.
 *
 * Lessons are adapted to the user's CEFR level, chosen topic, and speech formality register.
 * The module also provides helpers for topic suggestion and topic metadata lookup.
 *
 * @example
 * ```ts
 * const lesson = await generateLesson({
 *   targetLevel: 5,
 *   language: "Spanish",
 *   nativeLanguage: "English",
 *   topic: "travel",
 *   length: "medium",
 *   formality: "standard",
 * });
 * ```
 */

import OpenAI from "openai";
import { getLevelDescription } from "./level-system";
import { SpeechFormality } from "@/types/database";

// Lazily initialize OpenAI to avoid module-level instantiation during build
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// ============================================================================
// Types
// ============================================================================

export type LessonLength = "short" | "medium" | "long";

export interface LessonContent {
  title: string;
  body: string; // HTML formatted
  vocabulary: VocabularyItem[];
  grammarPoints: string[];
  wordCount: number;
}

export interface VocabularyItem {
  word: string;
  translation: string;
  context: string;
}

export interface GenerateLessonOptions {
  targetLevel: number;
  language: string;
  nativeLanguage: string;
  topic: string;
  length: LessonLength;
  formality?: SpeechFormality;
}

// ============================================================================
// Configuration
// ============================================================================

/** Word count targets for each length */
export const LENGTH_CONFIG: Record<LessonLength, { minWords: number; maxWords: number; targetWords: number }> = {
  short: { minWords: 50, maxWords: 100, targetWords: 75 },
  medium: { minWords: 200, maxWords: 400, targetWords: 300 },
  long: { minWords: 600, maxWords: 1000, targetWords: 800 },
};

/** Available topics for lessons */
export const LESSON_TOPICS = [
  { id: "travel", name: "Travel & Tourism", icon: "✈️" },
  { id: "food", name: "Food & Dining", icon: "🍽️" },
  { id: "daily_life", name: "Daily Life", icon: "🏠" },
  { id: "culture", name: "Culture & Traditions", icon: "🎭" },
  { id: "work", name: "Work & Career", icon: "💼" },
  { id: "news", name: "News & Current Events", icon: "📰" },
  { id: "nature", name: "Nature & Environment", icon: "🌿" },
  { id: "technology", name: "Technology", icon: "💻" },
  { id: "relationships", name: "People & Relationships", icon: "👥" },
  { id: "health", name: "Health & Wellness", icon: "🏃" },
  { id: "entertainment", name: "Entertainment", icon: "🎬" },
  { id: "education", name: "Education & Learning", icon: "📚" },
] as const;

export type TopicId = (typeof LESSON_TOPICS)[number]["id"];

/** Formality level descriptions for AI prompts */
const FORMALITY_DESCRIPTIONS: Record<SpeechFormality, { style: string; instructions: string }> = {
  casual: {
    style: "Casual/Informal",
    instructions: `- Use contractions freely (e.g., "can't", "won't", "gonna" equivalents in the target language)
- Include colloquial expressions and everyday slang appropriate for the level
- Use relaxed sentence structures typical of friendly conversation
- Vocabulary should be what friends and family use in everyday situations
- Avoid formal titles or honorifics unless culturally necessary`,
  },
  standard: {
    style: "Standard/Neutral",
    instructions: `- Use balanced, universally understood vocabulary
- Mix of contractions and full forms as appropriate
- Standard sentence structures suitable for general communication
- Vocabulary that works in most everyday situations
- Neutral tone that's neither too formal nor too casual`,
  },
  professional: {
    style: "Professional/Business",
    instructions: `- Use formal vocabulary appropriate for workplace settings
- Include polite forms and formal address (e.g., "usted" in Spanish, honorifics in Japanese)
- Avoid contractions and slang
- Use complete, well-structured sentences
- Include business and professional terminology relevant to the topic
- Maintain respectful, courteous tone throughout`,
  },
  academic: {
    style: "Academic/Scholarly",
    instructions: `- Use precise, technical vocabulary appropriate for the level
- Employ complex sentence structures and subordinate clauses
- Avoid any colloquialisms or informal expressions
- Include discipline-specific terminology when relevant
- Use formal connectors and transition phrases
- Maintain objective, analytical tone throughout`,
  },
};

// ============================================================================
// Lesson Generation
// ============================================================================

/**
 * Generate a lesson using Gemini AI.
 */
export async function generateLesson(options: GenerateLessonOptions): Promise<LessonContent> {
  const { targetLevel, language, nativeLanguage, topic, length, formality = "standard" } = options;
  const lengthConfig = LENGTH_CONFIG[length];
  const levelDesc = getLevelDescription(targetLevel);
  const formalityDesc = FORMALITY_DESCRIPTIONS[formality];

  const prompt = `Generate a reading passage for a language learner.

SPECIFICATIONS:
- Language: ${language}
- Target length: ${lengthConfig.targetWords} words (between ${lengthConfig.minWords}-${lengthConfig.maxWords})
- Difficulty: Level ${targetLevel}/20 (${levelDesc.cefr} - ${levelDesc.title})
- Topic: ${topic}
- Speech Style: ${formalityDesc.style}

LEARNER LEVEL DESCRIPTION:
At level ${targetLevel}, the learner can: ${levelDesc.description}

SPEECH FORMALITY INSTRUCTIONS:
${formalityDesc.instructions}

REQUIREMENTS:
1. Write the passage entirely in ${language}
2. Use vocabulary and grammar appropriate for this level
3. Make the content engaging and educational
4. Include a clear title in ${language}
5. Format the body with proper paragraphs using <p> tags
6. IMPORTANT: Match the speech style (${formalityDesc.style}) throughout - this affects word choice, sentence structure, and tone

VOCABULARY EXTRACTION:
After the passage, identify 5-8 key vocabulary words that a learner at this level should focus on.
These vocabulary words should match the ${formalityDesc.style} register.
For each word, provide:
- The word in ${language}
- Translation in ${nativeLanguage}
- A brief context showing how it's used

GRAMMAR POINTS:
List 2-3 grammar patterns used in the passage that are appropriate for this level.

RESPONSE FORMAT (JSON only, no markdown):
{
  "title": "Title in ${language}",
  "body": "<p>First paragraph...</p><p>Second paragraph...</p>",
  "vocabulary": [
    {"word": "palabra", "translation": "word", "context": "Example sentence..."}
  ],
  "grammarPoints": ["Present tense conjugation", "Article usage"]
}

Generate the lesson now:`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  const text = response.choices[0]?.message?.content || "";

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse lesson content from AI response");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Count words in body (strip HTML)
  const plainText = parsed.body.replace(/<[^>]*>/g, " ");
  const wordCount = plainText.split(/\s+/).filter((w: string) => w.length > 0).length;

  return {
    title: parsed.title,
    body: parsed.body,
    vocabulary: parsed.vocabulary || [],
    grammarPoints: parsed.grammarPoints || [],
    wordCount,
  };
}

/**
 * Suggest a topic based on user's learning motivations.
 */
export function suggestTopic(motivations: string[]): TopicId {
  // Map motivations to topic preferences
  const motivationToTopics: Record<string, TopicId[]> = {
    travel: ["travel", "food", "culture"],
    career: ["work", "technology", "news"],
    academic: ["education", "news", "culture"],
    personal: ["daily_life", "relationships", "entertainment"],
    family: ["relationships", "daily_life", "culture"],
    entertainment: ["entertainment", "culture", "food"],
  };

  // Collect all suggested topics based on motivations
  const suggestedTopics: TopicId[] = [];
  for (const motivation of motivations) {
    const topics = motivationToTopics[motivation];
    if (topics) {
      suggestedTopics.push(...topics);
    }
  }

  // If no matches, return a default
  if (suggestedTopics.length === 0) {
    return "daily_life";
  }

  // Return the most common suggestion (or first one)
  const topicCounts = suggestedTopics.reduce(
    (acc, topic) => {
      acc[topic] = (acc[topic] || 0) + 1;
      return acc;
    },
    {} as Record<TopicId, number>
  );

  const sortedTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
  return sortedTopics[0][0] as TopicId;
}

/**
 * Get topic display info.
 */
export function getTopicInfo(topicId: string) {
  return LESSON_TOPICS.find((t) => t.id === topicId) || LESSON_TOPICS[0];
}
