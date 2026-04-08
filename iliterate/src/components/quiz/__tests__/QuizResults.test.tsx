import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuizResults } from "@/components/quiz/QuizResults";

function makeProps(percentage: number) {
  return {
    results: {
      totalScore: Math.round((percentage / 100) * 10),
      totalMaxScore: 10,
      percentage,
      reading: {
        score: 4,
        maxScore: 5,
        xpAwarded: {
          skill: "reading",
          baseXP: 20,
          bonusXP: 5,
          totalXP: 25,
          reason: "Strong comprehension",
        },
        levelUp: null,
      },
      vocabulary: {
        score: 3,
        maxScore: 5,
        xpAwarded: {
          skill: "vocabulary",
          baseXP: 15,
          bonusXP: 0,
          totalXP: 15,
          reason: "Good vocabulary recall",
        },
        levelUp: null,
      },
    },
    newLevels: {
      reading: 8,
      vocabulary: 6,
      grammar: 5,
    },
    contentTitle: "Sample Story",
    onContinue: vi.fn(),
  };
}

describe("QuizResults", () => {
  it("renders score, percentage, XP, and links", () => {
    const props = makeProps(80);
    render(<QuizResults {...props} />);

    expect(screen.getByText("Great job!")).toBeInTheDocument();
    expect(screen.getByText("8/10")).toBeInTheDocument();
    expect(screen.getByText("80% correct")).toBeInTheDocument();
    expect(screen.getByText("+40 XP")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Library/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View Progress/i })).toBeInTheDocument();
  });

  it("shows excellent message at 90+", () => {
    render(<QuizResults {...makeProps(90)} />);
    expect(screen.getByText("Excellent work!")).toBeInTheDocument();
  });

  it("shows good-effort message for mid-range scores", () => {
    render(<QuizResults {...makeProps(60)} />);
    expect(screen.getByText("Good effort!")).toBeInTheDocument();
  });

  it("shows keep-practicing message below 50", () => {
    render(<QuizResults {...makeProps(40)} />);
    expect(screen.getByText("Keep practicing!")).toBeInTheDocument();
  });

  it("renders level-up section when at least one skill levels up", () => {
    const props = makeProps(85);
    props.results.reading.levelUp = {
      from: 7,
      to: 8,
      newCEFR: "B2",
      crossedCEFRBoundary: true,
    };

    render(<QuizResults {...props} />);

    expect(screen.getByText("Level Up!")).toBeInTheDocument();
    expect(screen.getByText(/Level 7/)).toBeInTheDocument();
    expect(screen.getByText(/Now B2!/)).toBeInTheDocument();
  });

  it("does not render level-up section when no level ups occurred", () => {
    render(<QuizResults {...makeProps(75)} />);
    expect(screen.queryByText("Level Up!")).not.toBeInTheDocument();
  });

  it("renders CEFR tags from numeric levels", () => {
    render(<QuizResults {...makeProps(70)} />);

    expect(screen.getByText("(B1)")).toBeInTheDocument();
    expect(screen.getByText("(A2)")).toBeInTheDocument();
  });

  it("supports optional continue callback without crashing", () => {
    const props = makeProps(70);
    render(<QuizResults {...props} onContinue={undefined} />);

    fireEvent.click(screen.getByRole("link", { name: /View Progress/i }));
    expect(screen.getByText("Great job!")).toBeInTheDocument();
  });
});
