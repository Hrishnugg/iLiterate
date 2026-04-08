/**
 * Quiz Generator — Mock-Object Testing
 *
 * Testing method: Mock-object testing
 * - Mocks the OpenAI API to test quiz generation logic in isolation
 * - Verifies prompt construction, response parsing, error handling
 * - Tests the gradeQuiz pure function directly
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { gradeQuiz } from "../quiz-generator";
import type { AssessmentQuestion } from "@/types/database";

// ---------------------------------------------------------------------------
// gradeQuiz — Pure Function Tests
// ---------------------------------------------------------------------------
describe("gradeQuiz", () => {
  const questions: AssessmentQuestion[] = [
    {
      id: "q1",
      type: "comprehension_mcq",
      question: "What color is the sky?",
      options: ["Red", "Blue", "Green", "Yellow"],
      correct_answer: "Blue",
    },
    {
      id: "q2",
      type: "comprehension_mcq",
      question: "What is 2+2?",
      options: ["3", "4", "5", "6"],
      correct_answer: "4",
    },
    {
      id: "q3",
      type: "vocabulary_fill_blank",
      question: "The ___ is hot",
      options: ["sun", "moon", "rain", "snow"],
      correct_answer: "sun",
    },
  ];

  it("scores all correct answers", () => {
    const result = gradeQuiz(questions, { q1: "Blue", q2: "4", q3: "sun" });
    expect(result.score).toBe(3);
    expect(result.maxScore).toBe(3);
    expect(result.percentage).toBe(100);
  });

  it("scores all wrong answers", () => {
    const result = gradeQuiz(questions, { q1: "Red", q2: "3", q3: "moon" });
    expect(result.score).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it("scores partial answers correctly", () => {
    const result = gradeQuiz(questions, { q1: "Blue", q2: "3", q3: "sun" });
    expect(result.score).toBe(2);
    expect(result.percentage).toBe(67); // Math.round(2/3 * 100)
  });

  it("treats missing answers as wrong", () => {
    const result = gradeQuiz(questions, { q1: "Blue" });
    expect(result.score).toBe(1);
    expect(result.maxScore).toBe(3);
  });

  it("marks each question with correct/incorrect", () => {
    const result = gradeQuiz(questions, { q1: "Blue", q2: "3", q3: "sun" });
    expect(result.gradedQuestions[0].correct).toBe(true);
    expect(result.gradedQuestions[1].correct).toBe(false);
    expect(result.gradedQuestions[2].correct).toBe(true);
  });

  it("attaches user_answer to graded questions", () => {
    const result = gradeQuiz(questions, { q1: "Red", q2: "4", q3: "moon" });
    expect(result.gradedQuestions[0].user_answer).toBe("Red");
    expect(result.gradedQuestions[1].user_answer).toBe("4");
    expect(result.gradedQuestions[2].user_answer).toBe("moon");
  });

  it("returns 0 percentage for empty question list", () => {
    const result = gradeQuiz([], {});
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it("requires exact string match (case-sensitive)", () => {
    const result = gradeQuiz(questions, { q1: "blue", q2: "4", q3: "Sun" });
    // "blue" !== "Blue", "Sun" !== "sun"
    expect(result.score).toBe(1); // only q2 matches
  });
});

// ---------------------------------------------------------------------------
// generateQuiz — Mock-Object Tests (OpenAI mocked)
// ---------------------------------------------------------------------------
describe("generateQuiz (mock-object testing)", () => {
  const mockCreate = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();

    // Mock the openai module
    vi.doMock("openai", () => ({
      default: class MockOpenAI {
        chat = {
          completions: {
            create: mockCreate,
          },
        };
      },
    }));
  });

  it("parses valid JSON array from OpenAI response", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                id: "q1",
                type: "multiple_choice",
                question: "What is the main idea?",
                options: ["A", "B", "C", "D"],
                correct_answer: "A",
                hint: "Think about the first paragraph",
              },
            ]),
          },
        },
      ],
    });

    const { generateQuiz } = await import("../quiz-generator");

    const result = await generateQuiz({
      content: {
        id: "test-id",
        user_id: "user-1",
        title: "Test Article",
        body: "<p>This is a test article about cats.</p>",
        language: "en",
        difficulty_level: "A2",
        numeric_level: 5,
        source_type: "text",
        word_count: 50,
        is_public: false,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
      userLevel: 5,
      nativeLanguage: "en",
      questionCount: 1,
    });

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].question).toBe("What is the main idea?");
    expect(result.contentId).toBe("test-id");
    expect(result.contentLevel).toBe(5);
  });

  it("throws when OpenAI returns non-JSON response", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Sorry, I cannot generate a quiz." } }],
    });

    const { generateQuiz } = await import("../quiz-generator");

    await expect(
      generateQuiz({
        content: {
          id: "test-id",
          user_id: "user-1",
          title: "Test",
          body: "content",
          language: "en",
          difficulty_level: "A1",
          numeric_level: 3,
          source_type: "text",
          word_count: 10,
          is_public: false,
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
        userLevel: 3,
        nativeLanguage: "en",
      })
    ).rejects.toThrow("Failed to parse quiz response from AI");
  });

  it("throws when OpenAI returns malformed JSON", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "[{broken json}]" } }],
    });

    const { generateQuiz } = await import("../quiz-generator");

    await expect(
      generateQuiz({
        content: {
          id: "test-id",
          user_id: "user-1",
          title: "Test",
          body: "content",
          language: "en",
          difficulty_level: "A1",
          numeric_level: 3,
          source_type: "text",
          word_count: 10,
          is_public: false,
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
        userLevel: 3,
        nativeLanguage: "en",
      })
    ).rejects.toThrow("Invalid JSON in quiz response");
  });

  it("assigns default IDs when questions lack them", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                type: "multiple_choice",
                question: "Q1?",
                options: ["A", "B", "C", "D"],
                correct_answer: "A",
              },
              {
                type: "multiple_choice",
                question: "Q2?",
                options: ["A", "B", "C", "D"],
                correct_answer: "B",
              },
            ]),
          },
        },
      ],
    });

    const { generateQuiz } = await import("../quiz-generator");

    const result = await generateQuiz({
      content: {
        id: "test-id",
        user_id: "user-1",
        title: "Test",
        body: "content",
        language: "en",
        difficulty_level: "B1",
        numeric_level: 7,
        source_type: "text",
        word_count: 100,
        is_public: false,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
      userLevel: 7,
      nativeLanguage: "en",
      questionCount: 2,
    });

    expect(result.questions[0].id).toBe("q1");
    expect(result.questions[1].id).toBe("q2");
  });

  it("includes saved vocabulary in prompt when provided", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                id: "q1",
                type: "multiple_choice",
                question: "Q?",
                options: ["A", "B", "C", "D"],
                correct_answer: "A",
              },
            ]),
          },
        },
      ],
    });

    const { generateQuiz } = await import("../quiz-generator");

    await generateQuiz({
      content: {
        id: "test-id",
        user_id: "user-1",
        title: "Test",
        body: "content",
        language: "es",
        difficulty_level: "A2",
        numeric_level: 5,
        source_type: "text",
        word_count: 50,
        is_public: false,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
      userLevel: 5,
      nativeLanguage: "en",
      savedVocabulary: [{ word: "gato" }, { word: "perro" }],
    });

    // Verify the prompt sent to OpenAI includes vocabulary
    const callArgs = mockCreate.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content;
    expect(promptContent).toContain("gato");
    expect(promptContent).toContain("perro");
  });

  it("uses target language for questions when userLevel >= 14", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                id: "q1",
                type: "multiple_choice",
                question: "Q?",
                options: ["A", "B", "C", "D"],
                correct_answer: "A",
              },
            ]),
          },
        },
      ],
    });

    const { generateQuiz } = await import("../quiz-generator");

    await generateQuiz({
      content: {
        id: "test-id",
        user_id: "user-1",
        title: "Test",
        body: "Artículo avanzado",
        language: "es",
        difficulty_level: "B2",
        numeric_level: 14,
        source_type: "text",
        word_count: 100,
        is_public: false,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
      userLevel: 14,
      nativeLanguage: "en",
    });

    const callArgs = mockCreate.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content;
    // At level 14+, questions should be in the target language (es)
    expect(promptContent).toContain("All questions should be in es");
  });
});
