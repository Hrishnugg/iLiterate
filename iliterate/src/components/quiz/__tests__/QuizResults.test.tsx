import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QuizResults } from '../QuizResults';

const baseResults = {
  totalScore: 8,
  totalMaxScore: 10,
  percentage: 80,
  reading: {
    score: 4,
    maxScore: 5,
    xpAwarded: { skill: 'reading', baseXP: 10, bonusXP: 5, totalXP: 15, reason: 'Good' },
    levelUp: null,
  },
  vocabulary: {
    score: 4,
    maxScore: 5,
    xpAwarded: { skill: 'vocab', baseXP: 10, bonusXP: 5, totalXP: 15, reason: 'Good' },
    levelUp: null,
  },
};

describe('QuizResults', () => {
  it('renders performance message and XP total', () => {
    render(<QuizResults results={baseResults as any} newLevels={{ reading: 2, vocabulary: 3, grammar: 1 }} />);

    expect(screen.getByText(/Great job!|Excellent work!|Good effort!|Keep practicing!/)).toBeInTheDocument();
    expect(screen.getByText('+30 XP')).toBeInTheDocument();
  });

  it('shows level up info when present', () => {
    const resultsWithLevelUp = {
      ...baseResults,
      reading: { ...baseResults.reading, levelUp: { from: 2, to: 3, newCEFR: 'B1', crossedCEFRBoundary: true } },
    };

    render(<QuizResults results={resultsWithLevelUp as any} newLevels={{ reading: 3, vocabulary: 2, grammar: 1 }} />);

    expect(screen.getByText(/Level Up!/)).toBeInTheDocument();
    expect(screen.getByText(/Level 2 → 3/)).toBeInTheDocument();
    expect(screen.getByText(/Now B1/)).toBeInTheDocument();
  });
});
