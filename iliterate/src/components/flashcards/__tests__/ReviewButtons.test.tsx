import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, afterEach } from "vitest";
import { ReviewButtons } from "../ReviewButtons";

afterEach(() => vi.restoreAllMocks());

describe("ReviewButtons", () => {
  it("renders four buttons with interval previews and calls onResponse", () => {
    const onResponse = vi.fn();
    const preview = { again: 1, hard: 2, good: 6, easy: 30 };

    render(<ReviewButtons intervalPreview={preview} onResponse={onResponse} />);

    expect(screen.getByText(/Again/)).toBeInTheDocument();
    expect(screen.getByText(/Hard/)).toBeInTheDocument();
    expect(screen.getByText(/Good/)).toBeInTheDocument();
    expect(screen.getByText(/Easy/)).toBeInTheDocument();

    // Click each button via label's nearest button
    const againBtn = screen.getByText("Again").closest("button")!;
    fireEvent.click(againBtn);
    expect(onResponse).toHaveBeenCalledWith("again");

    const hardBtn = screen.getByText("Hard").closest("button")!;
    fireEvent.click(hardBtn);
    expect(onResponse).toHaveBeenCalledWith("hard");

    const goodBtn = screen.getByText("Good").closest("button")!;
    fireEvent.click(goodBtn);
    expect(onResponse).toHaveBeenCalledWith("good");

    const easyBtn = screen.getByText("Easy").closest("button")!;
    fireEvent.click(easyBtn);
    expect(onResponse).toHaveBeenCalledWith("easy");
  });
});
