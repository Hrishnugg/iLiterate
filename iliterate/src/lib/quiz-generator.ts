import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { Content, AssessmentQuestion, CEFRLevel, numericLevelToCEFR } from "@/types/database";

// Lazy initialization
let _genAI: GoogleGenerativeAI | null = null;
let _geminiModel: GenerativeModel | null = null;

function getGeminiModel(): GenerativeModel {
  if (!_geminiModel) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_AI_API_KEY is not set in environment variables");
    }
    _genAI = new GoogleGenerativeAI(apiKey);
    _geminiModel = _genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });
  }
  return _geminiModel;
}

export interface GenerateQuizParams {
  content: Content;
  userLevel: number;
  nativeLanguage: string;
  savedVocabulary?: Array<{ word: string; context?: string }>;
  questionCounts?: {
    comprehension: number;
    vocabulary: number;
  };
}

export interface GeneratedQuiz {
  questions: AssessmentQuestion[];
  contentId: string;
  contentLevel: number;
  generatedAt: string;
}

/**
 * Guidelines for question difficulty based on CEFR level
 */
const LEVEL_GUIDELINES: Record<CEFRLevel, string> = {
  A1: "Very simple questions. Use basic vocabulary. Questions can be in native language. Focus on literal understanding.",
  A2: "Simple questions with common vocabulary. Mix of native and target language. Focus on main ideas.",
  B1: "Moderate complexity. Questions mostly in target language. Test understanding of opinions and feelings.",
  B2: "Complex questions in target language. Test inference and implicit meaning.",
  C1: "Sophisticated questions. Test nuanced understanding and author's intent.",
  C2: "Native-level complexity. Test subtle meanings, cultural references, and advanced inference.",
};

/**
 * Generate a quiz for a piece of content using Gemini AI
 */
export async function generateQuiz(params: GenerateQuizParams): Promise<GeneratedQuiz> {
  const {
    content,
    userLevel,
    nativeLanguage,
    savedVocabulary = [],
    questionCounts = { comprehension: 3, vocabulary: 3 },
  } = params;

  const cefrLevel = numericLevelToCEFR(userLevel);
  const contentCEFR = content.difficulty_level;

  // Truncate content body to avoid token limits (roughly 3000 chars)
  const truncatedBody = content.body
    .replace(/<[^>]*>/g, " ") // Strip HTML tags
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
    .slice(0, 3000);

  // Build vocabulary context for fill-in-blank questions
  const vocabContext = savedVocabulary.length > 0
    ? `The student has saved these vocabulary words from this content: ${savedVocabulary.map(v => v.word).join(", ")}. Use some of these for fill-in-blank questions.`
    : "Create vocabulary questions from key words that appeared in the text.";

  const prompt = `You are creating a language learning quiz for a student.

Student Profile:
- Native language: ${nativeLanguage}
- Current level: ${userLevel}/20 (${cefrLevel} CEFR)
- Content difficulty: ${contentCEFR}

The student just read this text in ${content.language}:
"""
${truncatedBody}
"""

${vocabContext}

Level Guidelines: ${LEVEL_GUIDELINES[cefrLevel]}

Generate a quiz with EXACTLY:
- ${questionCounts.comprehension} reading comprehension multiple choice questions
- ${questionCounts.vocabulary} vocabulary fill-in-the-blank questions

Return your response as a JSON array with this EXACT structure:
[
  {
    "id": "q1",
    "type": "comprehension_mcq",
    "question": "Question text (in ${userLevel <= 6 ? nativeLanguage : content.language})",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "Option A",
    "hint": "Optional hint for struggling students"
  },
  {
    "id": "q2",
    "type": "vocabulary_fill_blank",
    "question": "Complete the sentence: La casa ___ muy grande.",
    "context": "The house is very big. (translation for context)",
    "correct_answer": "es",
    "hint": "Think about the verb 'to be' for descriptions"
  }
]

Important rules:
1. Comprehension questions should test understanding, not just word recall
2. For levels 1-6 (A1-A2), questions can be in the native language
3. For levels 7+ (B1+), questions should be in the target language
4. Fill-in-blank sentences should have clear context clues
5. Each question needs a unique ID (q1, q2, q3, etc.)
6. Provide 4 options for multiple choice (one correct, three plausible wrong)
7. Hints should guide without giving away the answer`;

  const geminiModel = getGeminiModel();
  const result = await geminiModel.generateContent(prompt);
  const textResponse = result.response.text();

  // Extract JSON from response
  const jsonMatch = textResponse.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("Failed to parse quiz response:", textResponse);
    throw new Error("Failed to parse quiz response from AI");
  }

  let questions: AssessmentQuestion[];
  try {
    questions = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Invalid JSON in quiz response:", e);
    throw new Error("Invalid JSON in quiz response");
  }

  // Validate questions have required fields
  questions = questions.map((q, index) => ({
    id: q.id || `q${index + 1}`,
    type: q.type,
    question: q.question,
    options: q.options,
    correct_answer: q.correct_answer,
    context: q.context,
    hint: q.hint,
  }));

  return {
    questions,
    contentId: content.id,
    contentLevel: content.numeric_level || 5,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Grade quiz answers and calculate scores per skill
 */
export function gradeQuiz(
  questions: AssessmentQuestion[],
  userAnswers: Record<string, string>
): {
  gradedQuestions: AssessmentQuestion[];
  readingScore: number;
  readingMaxScore: number;
  vocabularyScore: number;
  vocabularyMaxScore: number;
} {
  let readingScore = 0;
  let readingMaxScore = 0;
  let vocabularyScore = 0;
  let vocabularyMaxScore = 0;

  const gradedQuestions = questions.map((q) => {
    const userAnswer = userAnswers[q.id] || "";

    // For fill-in-blank, do fuzzy matching (case-insensitive, trim whitespace)
    let isCorrect: boolean;
    if (q.type === "vocabulary_fill_blank") {
      isCorrect = userAnswer.toLowerCase().trim() === q.correct_answer.toLowerCase().trim();
      vocabularyMaxScore++;
      if (isCorrect) vocabularyScore++;
    } else {
      // For MCQ, exact match
      isCorrect = userAnswer === q.correct_answer;
      readingMaxScore++;
      if (isCorrect) readingScore++;
    }

    return {
      ...q,
      user_answer: userAnswer,
      correct: isCorrect,
    };
  });

  return {
    gradedQuestions,
    readingScore,
    readingMaxScore,
    vocabularyScore,
    vocabularyMaxScore,
  };
}
