import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FillBlankQuestion } from "@/components/quiz/FillBlankQuestion";
import type { AssessmentQuestion } from "@/types/database";

const baseQuestion: AssessmentQuestion = {
  id: "q2",
  type: "vocabulary_fill_blank",
  question: "Complete: La casa ___ grande.",
  context: "The house is big.",
  correct_answer: "es",
  hint: "Think of the verb 'to be'.",
};

describe("FillBlankQuestion", () => {
  it("renders question, context, and hint", () => {
    render(<FillBlankQuestion question={baseQuestion} answer="" onAnswer={vi.fn()} />);

    expect(screen.getByText(baseQuestion.question)).toBeInTheDocument();
    expect(screen.getByText("The house is big.")).toBeInTheDocument();
    expect(screen.getByText(/Hint:/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type your answer/i)).toBeInTheDocument();
  });

  it("calls onAnswer on input change when enabled", () => {
    const onAnswer = vi.fn();
    render(<FillBlankQuestion question={baseQuestion} answer="" onAnswer={onAnswer} />);

    fireEvent.change(screen.getByPlaceholderText(/Type your answer/i), {
      target: { value: "es" },
    });
    expect(onAnswer).toHaveBeenCalledWith("es");
  });

  it("does not call onAnswer when disabled", () => {
    const onAnswer = vi.fn();
    render(
      <FillBlankQuestion
        question={baseQuestion}
        answer=""
        onAnswer={onAnswer}
        disabled={true}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Type your answer/i), {
      target: { value: "es" },
    });
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("shows incorrect result state and correct answer", () => {
    render(
      <FillBlankQuestion
        question={{ ...baseQuestion, correct: false }}
        answer="soy"
        onAnswer={vi.fn()}
        showResult={true}
      />
    );

    const input = screen.getByDisplayValue("soy");
    expect(input).toHaveClass("border-red-500");
    expect(screen.getByText(/Correct answer:/i)).toBeInTheDocument();
    expect(screen.getByText("es")).toBeInTheDocument();
  });

  it("shows correct result state and hides hint while showing results", () => {
    render(
      <FillBlankQuestion
        question={{ ...baseQuestion, correct: true }}
        answer="es"
        onAnswer={vi.fn()}
        showResult={true}
      />
    );

    const input = screen.getByDisplayValue("es");
    expect(input).toHaveClass("border-green-500");
    expect(screen.queryByText(/Hint:/i)).not.toBeInTheDocument();
  });
});
