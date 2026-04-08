import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuizContainer } from "@/components/quiz/QuizContainer";
import type { AssessmentQuestion } from "@/types/database";

vi.mock("@/components/quiz/MCQQuestion", () => ({
  MCQQuestion: ({ onAnswer }: { onAnswer: (answer: string) => void }) => (
    <div>
      <div>Mock MCQ</div>
      <button onClick={() => onAnswer("Option A")}>Select MCQ</button>
    </div>
  ),
}));

vi.mock("@/components/quiz/FillBlankQuestion", () => ({
  FillBlankQuestion: ({ answer, onAnswer }: { answer: string; onAnswer: (answer: string) => void }) => (
    <div>
      <div>Mock Fill Blank</div>
      <input
        aria-label="fill-blank-input"
        value={answer}
        onChange={(e) => onAnswer(e.target.value)}
      />
    </div>
  ),
}));

vi.mock("@/components/quiz/QuizResults", () => ({
  QuizResults: ({ results, onContinue }: { results: { percentage: number }; onContinue?: () => void }) => (
    <div>
      <div>{`Results ${results.percentage}%`}</div>
      <button onClick={onContinue}>Continue</button>
    </div>
  ),
}));

const questions: AssessmentQuestion[] = [
  {
    id: "q1",
    type: "comprehension_mcq",
    question: "Q1",
    options: ["Option A", "Option B", "Option C", "Option D"],
    correct_answer: "Option A",
  },
  {
    id: "q2",
    type: "vocabulary_fill_blank",
    question: "Q2",
    correct_answer: "hola",
  },
];

const quizPayload = {
  questions,
  contentLevel: 6,
  generatedAt: "2026-04-07T00:00:00.000Z",
};

const submitPayload = {
  results: {
    totalScore: 8,
    totalMaxScore: 10,
    percentage: 80,
    reading: {
      score: 4,
      maxScore: 5,
      xpAwarded: { skill: "reading", baseXP: 10, bonusXP: 2, totalXP: 12, reason: "ok" },
      levelUp: null,
    },
    vocabulary: {
      score: 4,
      maxScore: 5,
      xpAwarded: { skill: "vocabulary", baseXP: 10, bonusXP: 0, totalXP: 10, reason: "ok" },
      levelUp: null,
    },
  },
  gradedQuestions: questions,
  newLevels: {
    reading: 7,
    vocabulary: 7,
    grammar: 6,
  },
};

describe("QuizContainer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads quiz and renders first question state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => quizPayload,
      })
    );

    render(<QuizContainer contentId="content-1" contentTitle="Story One" />);

    expect(screen.getByText(/Generating your quiz/i)).toBeInTheDocument();
    expect(await screen.findByText("Reading Quiz")).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("0/2 answered")).toBeInTheDocument();
    expect(screen.getByText("Reading Comprehension")).toBeInTheDocument();
    expect(screen.getByText("Mock MCQ")).toBeInTheDocument();
  });

  it("navigates, submits, and displays results", async () => {
    const onComplete = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => quizPayload })
      .mockResolvedValueOnce({ ok: true, json: async () => submitPayload });

    vi.stubGlobal("fetch", fetchMock);

    render(<QuizContainer contentId="content-2" onComplete={onComplete} />);

    await screen.findByText("Reading Quiz");

    fireEvent.click(screen.getByRole("button", { name: /Select MCQ/i }));
    expect(screen.getByText("1/2 answered")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByText("Vocabulary")).toBeInTheDocument();
    expect(screen.getByText("Mock Fill Blank")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("fill-blank-input"), {
      target: { value: "hola" },
    });

    const submitButton = screen.getByRole("button", { name: /Submit Quiz/i });
    expect(submitButton).not.toBeDisabled();
    fireEvent.click(submitButton);

    await screen.findByText("Results 80%");
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);

    const submitCall = fetchMock.mock.calls[1];
    expect(submitCall[0]).toBe("/api/quiz/submit");
    const body = JSON.parse(submitCall[1].body as string);
    expect(body.contentId).toBe("content-2");
    expect(body.answers).toEqual({ q1: "Option A", q2: "hola" });
    expect(body.timeTakenSeconds).toBeTypeOf("number");
  });

  it("shows load error state when quiz generation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    );

    render(<QuizContainer contentId="content-3" />);

    expect(await screen.findByText("Failed to generate quiz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try Again/i })).toBeInTheDocument();
  });

  it("shows no-questions state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...quizPayload, questions: [] }),
      })
    );

    render(<QuizContainer contentId="content-4" />);

    expect(await screen.findByText("No questions available")).toBeInTheDocument();
  });

  it("shows submit error state when submission fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...quizPayload, questions: [questions[0]] }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    vi.stubGlobal("fetch", fetchMock);

    render(<QuizContainer contentId="content-5" />);
    await screen.findByText("Reading Quiz");

    fireEvent.click(screen.getByRole("button", { name: /Select MCQ/i }));
    fireEvent.click(screen.getByRole("button", { name: /Submit Quiz/i }));

    await waitFor(() => {
      expect(screen.getByText("Failed to submit quiz")).toBeInTheDocument();
    });
  });
});
