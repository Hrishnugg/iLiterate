import OpenAI from "openai";
import { Content, AssessmentQuestion, CEFRLevel, numericLevelToCEFR } from "@/types/database";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GenerateQuizParams {
  content: Content;
  userLevel: number;
  nativeLanguage: string;
  savedVocabulary?: Array<{ word: string; context?: string }>;
  questionCount?: number;
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
 * Generate a quiz for a piece of content using OpenAI
 */
export async function generateQuiz(params: GenerateQuizParams): Promise<GeneratedQuiz> {
  const {
    content,
    userLevel,
    nativeLanguage,
    savedVocabulary = [],
    questionCount = 5,
  } = params;

  const cefrLevel = numericLevelToCEFR(userLevel);
  const contentCEFR = content.difficulty_level;

  // Truncate content body to avoid token limits (roughly 3000 chars)
  const truncatedBody = content.body
    .replace(/<[^>]*>/g, " ") // Strip HTML tags
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
    .slice(0, 3000);

  // Build vocabulary context
  const vocabContext = savedVocabulary.length > 0
    ? `The student has saved these vocabulary words: ${savedVocabulary.map(v => v.word).join(", ")}. You may include questions about these words.`
    : "";

  // Determine question language based on level (14+ = target language)
  const questionLanguage = userLevel >= 14 ? content.language : nativeLanguage;

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

Generate EXACTLY ${questionCount} multiple choice questions. All questions should be in ${questionLanguage}.

Question types to include:
- Reading comprehension (what happened, who did what, main idea)
- Vocabulary meaning (what does this word mean in context)
- Simple inference (why did something happen)

Return your response as a JSON array with this EXACT structure:
[
  {
    "id": "q1",
    "type": "multiple_choice",
    "question": "Question text in ${questionLanguage}",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "Option A",
    "hint": "Optional hint for struggling students"
  }
]

Important rules:
1. Keep questions simple and clear - appropriate for the student's level
2. All questions and options should be in ${questionLanguage}
3. Each question needs a unique ID (q1, q2, q3, etc.)
4. Provide 4 options for each question (one correct, three plausible but clearly wrong)
5. Make wrong options plausible but distinguishable from the correct answer
6. Hints should guide without giving away the answer
7. Focus on understanding the content, not tricky wordplay`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  const textResponse = response.choices[0]?.message?.content || "";

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
 * Generate a quiz directly from content body (for lesson sessions)
 */
export async function generateQuizFromContent(
  contentBody: string,
  targetLevel: number,
  targetLanguage: string,
  nativeLanguage: string,
  vocabulary: Array<{ word: string; translation: string; context?: string }>,
  questionCount: number = 5
): Promise<AssessmentQuestion[]> {
  const cefrLevel = numericLevelToCEFR(targetLevel);

  // Truncate content body to avoid token limits
  const truncatedBody = contentBody
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);

  const vocabContext = vocabulary.length > 0
    ? `Key vocabulary from the text: ${vocabulary.map(v => `${v.word} (${v.translation})`).join(", ")}. You may include questions about these words.`
    : "";

  // Determine question language based on level (14+ = target language)
  const questionLanguage = targetLevel >= 14 ? targetLanguage : nativeLanguage;

  const prompt = `You are creating a language learning quiz.

Student Profile:
- Native language: ${nativeLanguage}
- Current level: ${targetLevel}/20 (${cefrLevel} CEFR)

The student just read this text in ${targetLanguage}:
"""
${truncatedBody}
"""

${vocabContext}

Level Guidelines: ${LEVEL_GUIDELINES[cefrLevel]}

Generate EXACTLY ${questionCount} multiple choice questions. All questions should be in ${questionLanguage}.

Question types to include:
- Reading comprehension (what happened, who did what, main idea)
- Vocabulary meaning (what does this word mean in context)
- Simple inference (why did something happen)

Return your response as a JSON array with this EXACT structure:
[
  {
    "id": "q1",
    "type": "multiple_choice",
    "question": "Question text in ${questionLanguage}",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "Option A",
    "hint": "Optional hint"
  }
]

Rules:
1. Keep questions simple and clear - appropriate for the student's level
2. All questions and options should be in ${questionLanguage}
3. Each question needs a unique ID (q1, q2, etc.)
4. Provide 4 options (one correct, three plausible but clearly wrong)
5. Make wrong options plausible but distinguishable from the correct answer
6. Focus on understanding the content, not tricky wordplay`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  const textResponse = response.choices[0]?.message?.content || "";

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

  // Validate and normalize questions
  return questions.map((q, index) => ({
    id: q.id || `q${index + 1}`,
    type: q.type,
    question: q.question,
    options: q.options,
    correct_answer: q.correct_answer,
    context: q.context,
    hint: q.hint,
  }));
}

/**
 * Grade quiz answers and calculate score
 */
export function gradeQuiz(
  questions: AssessmentQuestion[],
  userAnswers: Record<string, string>
): {
  gradedQuestions: AssessmentQuestion[];
  score: number;
  maxScore: number;
  percentage: number;
} {
  let score = 0;
  const maxScore = questions.length;

  const gradedQuestions = questions.map((q) => {
    const userAnswer = userAnswers[q.id] || "";
    const isCorrect = userAnswer === q.correct_answer;

    if (isCorrect) score++;

    return {
      ...q,
      user_answer: userAnswer,
      correct: isCorrect,
    };
  });

  return {
    gradedQuestions,
    score,
    maxScore,
    percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
  };
}
