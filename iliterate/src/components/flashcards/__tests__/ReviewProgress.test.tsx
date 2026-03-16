import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ReviewProgress } from "../ReviewProgress";

describe("ReviewProgress", () => {
  it("displays counts and remaining reviews for non-premium users", () => {
    render(<ReviewProgress completed={1} total={4} remainingReviews={5} isPremium={false} />);

    expect(screen.getByText(/1 \/ 4 cards/)).toBeInTheDocument();
    expect(screen.getByText(/5 reviews left today/)).toBeInTheDocument();
  });

  it("hides remaining reviews for premium users", () => {
    render(<ReviewProgress completed={2} total={5} isPremium={true} />);

    expect(screen.getByText(/2 \/ 5 cards/)).toBeInTheDocument();
    expect(screen.queryByText(/reviews left today/)).toBeNull();
  });
});
