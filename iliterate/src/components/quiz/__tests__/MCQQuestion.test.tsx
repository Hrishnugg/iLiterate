import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MCQQuestion } from "@/components/quiz/MCQQuestion";
import type { AssessmentQuestion } from "@/types/database";

const question: AssessmentQuestion = {
  id: "q1",
  type: "comprehension_mcq",
  question: "What is the main idea?",
  options: ["Option A", "Option B", "Option C", "Option D"],
  correct_answer: "Option B",
  hint: "Focus on the opening paragraph.",
};

describe("MCQQuestion", () => {
  it("renders question, options, and hint", () => {
    render(<MCQQuestion question={question} onAnswer={vi.fn()} />);

    expect(screen.getByText("What is the main idea?")).toBeInTheDocument();
    expect(screen.getByText(/Hint: Focus on the opening paragraph/i)).toBeInTheDocument();
    expect(screen.getByText("Option A")).toBeInTheDocument();
    expect(screen.getByText("Option D")).toBeInTheDocument();
  });

  it("calls onAnswer when option is clicked and enabled", () => {
    const onAnswer = vi.fn();
    render(<MCQQuestion question={question} onAnswer={onAnswer} />);

    fireEvent.click(screen.getByText("Option C"));
    expect(onAnswer).toHaveBeenCalledWith("Option C");
  });

  it("does not call onAnswer when disabled", () => {
    const onAnswer = vi.fn();
    render(<MCQQuestion question={question} onAnswer={onAnswer} disabled={true} />);

    fireEvent.click(screen.getByText("Option C"));
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("shows result styling and correct-answer helper when incorrect", () => {
    render(
      <MCQQuestion
        question={{ ...question, correct: false }}
        selectedAnswer="Option A"
        showResult={true}
        onAnswer={vi.fn()}
      />
    );

    const correctOption = screen.getAllByText("Option B")[0].closest("button");
    const selectedWrongOption = screen.getByText("Option A").closest("button");

    expect(correctOption).toHaveClass("border-green-500");
    expect(selectedWrongOption).toHaveClass("border-red-500");
    expect(screen.getByText(/Correct answer:/i)).toBeInTheDocument();
    expect(screen.getAllByText("Option B").length).toBeGreaterThanOrEqual(2);
  });

  it("hides hint during result view", () => {
    render(<MCQQuestion question={question} onAnswer={vi.fn()} showResult={true} />);
    expect(screen.queryByText(/Hint:/i)).not.toBeInTheDocument();
  });

  it("applies primary border and background to the selected option before result mode", () => {
    render(<MCQQuestion question={question} selectedAnswer="Option C" onAnswer={vi.fn()} />);

    const selectedBtn = screen.getByText("Option C").closest("button");
    const unselectedBtn = screen.getByText("Option A").closest("button");

    expect(selectedBtn).toHaveClass("border-primary");
    expect(selectedBtn).toHaveClass("bg-primary/5");
    expect(unselectedBtn).not.toHaveClass("border-primary");
    expect(unselectedBtn).not.toHaveClass("bg-primary/5");
  });

  it("styles the letter badge with primary colors for the selected option before result mode", () => {
    const { container } = render(
      <MCQQuestion question={question} selectedAnswer="Option A" onAnswer={vi.fn()} />
    );

    // First button is Option A (selected); its badge span should carry primary colours
    const badges = container.querySelectorAll("button span span:first-child");
    const selectedBadge = badges[0];
    expect(selectedBadge).toHaveClass("border-primary");
    expect(selectedBadge).toHaveClass("bg-primary");
    expect(selectedBadge).toHaveClass("text-primary-foreground");

    // Option B badge should carry neutral colours
    const neutralBadge = badges[1];
    expect(neutralBadge).toHaveClass("border-muted-foreground/30");
    expect(neutralBadge).not.toHaveClass("border-primary");
  });

  it("shows green styling for the correct-and-selected option in result mode and omits correct-answer helper", () => {
    render(
      <MCQQuestion
        question={{ ...question, correct: true }}
        selectedAnswer="Option B"
        showResult={true}
        onAnswer={vi.fn()}
      />
    );

    const correctBtn = screen.getAllByText("Option B")[0].closest("button");
    expect(correctBtn).toHaveClass("border-green-500");
    // When the answer was correct, the "Correct answer:" footer should NOT appear
    expect(screen.queryByText(/Correct answer:/i)).not.toBeInTheDocument();
  });

  it("highlights the correct unselected option green and the selected wrong option red in result mode", () => {
    render(
      <MCQQuestion
        question={{ ...question, correct: false }}
        selectedAnswer="Option D"
        showResult={true}
        onAnswer={vi.fn()}
      />
    );

    const correctBtn = screen.getAllByText("Option B")[0].closest("button");
    const wrongBtn = screen.getByText("Option D").closest("button");
    const neutralBtn = screen.getByText("Option A").closest("button");

    expect(correctBtn).toHaveClass("border-green-500");
    expect(wrongBtn).toHaveClass("border-red-500");
    expect(neutralBtn).not.toHaveClass("border-green-500");
    expect(neutralBtn).not.toHaveClass("border-red-500");
  });
});
