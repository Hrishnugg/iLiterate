import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Content, AssessmentQuestion } from "@/types/database";

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}));

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: createMock,
        },
      };
    },
  };
});

import {
  generateQuiz,
  generateQuizFromContent,
  gradeQuiz,
} from "@/lib/quiz-generator";

const content: Content = {
  id: "content-1",
  title: "Quiz Content",
  body: "<p>Hola mundo</p>",
  language: "es",
  difficulty_level: "A2",
  content_type: "article",
  topic_tags: [],
  word_count: 20,
  estimated_reading_time: 1,
  source_url: null,
  is_generated: true,
  created_at: "2026-04-07T00:00:00.000Z",
};

describe("quiz-generator", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("generates quiz and normalizes missing IDs", async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: `Here is your quiz:\n[
              {"id":"q1","type":"comprehension_mcq","question":"Q1","options":["A","B","C","D"],"correct_answer":"A","hint":"h1"},
              {"type":"vocabulary_fill_blank","question":"Q2","correct_answer":"hola","context":"ctx"}
            ]`,
          },
        },
      ],
    });

    const result = await generateQuiz({
      content,
      userLevel: 5,
      nativeLanguage: "en",
      savedVocabulary: [{ word: "hola" }],
      questionCounts: { comprehension: 1, vocabulary: 1 },
    });

    expect(result.contentId).toBe("content-1");
    expect(result.contentLevel).toBe(5);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].id).toBe("q1");
    expect(result.questions[1].id).toBe("q2");
    expect(result.generatedAt).toBeTypeOf("string");

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0].model).toBe("gpt-4o-mini");
  });

  it("throws when AI response does not include parseable JSON array", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: "No JSON here" } }],
    });

    await expect(
      generateQuiz({
        content,
        userLevel: 8,
        nativeLanguage: "en",
      })
    ).rejects.toThrow("Failed to parse quiz response from AI");
  });

  it("throws when AI response contains invalid JSON", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: "[{ invalid json }]" } }],
    });

    await expect(
      generateQuiz({
        content,
        userLevel: 8,
        nativeLanguage: "en",
      })
    ).rejects.toThrow("Invalid JSON in quiz response");
  });

  it("generates quiz from raw content and normalizes IDs", async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: `[
              {"type":"comprehension_mcq","question":"Q1","options":["A","B","C","D"],"correct_answer":"A"}
            ]`,
          },
        },
      ],
    });

    const questions = await generateQuizFromContent(
      "<div>Texto base</div>",
      9,
      "es",
      "en",
      [{ word: "texto", translation: "text" }],
      1,
      0
    );

    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe("q1");
    expect(questions[0].type).toBe("comprehension_mcq");
  });

  it("throws from generateQuizFromContent when response has no JSON array", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: "No array in this response at all." } }],
    });

    await expect(
      generateQuizFromContent("<p>Text</p>", 7, "es", "en", [], 1, 0)
    ).rejects.toThrow("Failed to parse quiz response from AI");
  });

  it("throws from generateQuizFromContent when JSON is malformed", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: "[{bad json}]" } }],
    });

    await expect(
      generateQuizFromContent("<p>Text</p>", 7, "es", "en", [], 1, 0)
    ).rejects.toThrow("Invalid JSON in quiz response");
  });

  it("grades MCQ answer as incorrect and does not increment reading score", () => {
    const questions: AssessmentQuestion[] = [
      {
        id: "q1",
        type: "comprehension_mcq",
        question: "Q1",
        options: ["A", "B", "C", "D"],
        correct_answer: "B",
      },
    ];

    const graded = gradeQuiz(questions, { q1: "A" });

    expect(graded.readingScore).toBe(0);
    expect(graded.readingMaxScore).toBe(1);
    expect(graded.gradedQuestions[0].correct).toBe(false);
    expect(graded.gradedQuestions[0].user_answer).toBe("A");
  });

  it("gradeQuiz uses empty string for missing answers and marks them wrong", () => {
    const questions: AssessmentQuestion[] = [
      {
        id: "q1",
        type: "comprehension_mcq",
        question: "Q1",
        correct_answer: "B",
      },
      {
        id: "q2",
        type: "vocabulary_fill_blank",
        question: "Q2",
        correct_answer: "hola",
      },
    ];

    const graded = gradeQuiz(questions, {});

    expect(graded.gradedQuestions[0].user_answer).toBe("");
    expect(graded.gradedQuestions[0].correct).toBe(false);
    expect(graded.gradedQuestions[1].user_answer).toBe("");
    expect(graded.gradedQuestions[1].correct).toBe(false);
    expect(graded.readingScore).toBe(0);
    expect(graded.vocabularyScore).toBe(0);
  });

  it("gradeQuiz trims whitespace on both answer and correct_answer for fill-blank comparison", () => {
    const questions: AssessmentQuestion[] = [
      {
        id: "q1",
        type: "vocabulary_fill_blank",
        question: "Q1",
        correct_answer: "es ",   // trailing space on correct answer
      },
    ];

    const graded = gradeQuiz(questions, { q1: "es" });
    // Both sides are trimmed so they match
    expect(graded.gradedQuestions[0].correct).toBe(true);
    expect(graded.vocabularyScore).toBe(1);
  });

  it("grades mixed MCQ and fill-blank answers with expected scoring", () => {
    const questions: AssessmentQuestion[] = [
      {
        id: "q1",
        type: "comprehension_mcq",
        question: "Q1",
        options: ["A", "B", "C", "D"],
        correct_answer: "B",
      },
      {
        id: "q2",
        type: "vocabulary_fill_blank",
        question: "Q2",
        correct_answer: "Hola",
      },
      {
        id: "q3",
        type: "vocabulary_fill_blank",
        question: "Q3",
        correct_answer: "adios",
      },
    ];

    const graded = gradeQuiz(questions, {
      q1: "B",
      q2: "  hola  ",
      q3: "hasta luego",
    });

    expect(graded.readingScore).toBe(1);
    expect(graded.readingMaxScore).toBe(1);
    expect(graded.vocabularyScore).toBe(1);
    expect(graded.vocabularyMaxScore).toBe(2);
    expect(graded.gradedQuestions[0].correct).toBe(true);
    expect(graded.gradedQuestions[1].correct).toBe(true);
    expect(graded.gradedQuestions[2].correct).toBe(false);
    expect(graded.gradedQuestions[2].user_answer).toBe("hasta luego");
  });
});
