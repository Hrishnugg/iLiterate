import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuizContainer } from '../QuizContainer';

const mockQuiz = {
  questions: [
    {
      id: 'q1',
      type: 'comprehension_mcq',
      question: 'Q1?',
      options: ['a', 'b'],
      correct_answer: 'a',
    },
    {
      id: 'q2',
      type: 'vocab_fill_blank',
      question: 'Q2?'
    }
  ],
  contentLevel: 1,
  generatedAt: 'now',
};

const mockResult = {
  results: {
    totalScore: 2,
    totalMaxScore: 2,
    percentage: 100,
    reading: { score: 1, maxScore: 1, xpAwarded: { skill: 'reading', baseXP: 10, bonusXP: 0, totalXP: 10, reason: 'ok' }, levelUp: null },
    vocabulary: { score: 1, maxScore: 1, xpAwarded: { skill: 'vocab', baseXP: 10, bonusXP: 0, totalXP: 10, reason: 'ok' }, levelUp: null },
  },
  gradedQuestions: [],
  newLevels: { reading: 1, vocabulary: 1, grammar: 1 },
};

describe('QuizContainer', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = vi.fn((url: string) => {
      if (url.endsWith('/generate')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockQuiz) } as any);
      }
      if (url.endsWith('/submit')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockResult) } as any);
      }
      return Promise.resolve({ ok: false } as any);
    });
  });

  it('loads quiz, navigates, answers and submits', async () => {
    render(<QuizContainer contentId="c1" />);

    // Loading message
    expect(screen.getByText(/Generating your quiz/)).toBeInTheDocument();

    // Wait for quiz to load and first question to render
    await waitFor(() => expect(screen.getByText('Q1?')).toBeInTheDocument());

    // Answer first question
    fireEvent.click(screen.getByText('a'));

    // Next to second
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => expect(screen.getByText('Q2?')).toBeInTheDocument());

    // Fill answer for second
    fireEvent.change(screen.getByPlaceholderText('Type your answer...'), { target: { value: 'ans' } });

    // Submit
    fireEvent.click(screen.getByText('Submit Quiz'));

    // Wait for results
    await waitFor(() => expect(screen.getByText('+20 XP')).toBeInTheDocument());
  });
});
