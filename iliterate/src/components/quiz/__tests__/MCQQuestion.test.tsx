import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { within } from '@testing-library/react';
import { MCQQuestion } from '../MCQQuestion';

const makeQuestion = (overrides = {}) => ({
  id: 'q1',
  type: 'comprehension_mcq',
  question: 'What does hola mean?',
  hint: 'A greeting',
  options: ['hello', 'bye', 'please'],
  correct_answer: 'hello',
  correct: undefined,
  ...overrides,
});

describe('MCQQuestion', () => {
  it('renders options and calls onAnswer when clicked', () => {
    const q = makeQuestion();
    const onAnswer = vi.fn();
    render(<MCQQuestion question={q as any} onAnswer={onAnswer} />);

    const opt = screen.getByText('hello');
    fireEvent.click(opt);
    expect(onAnswer).toHaveBeenCalledWith('hello');
  });

  it('shows correct/incorrect styling when showResult is true', () => {
    const q = makeQuestion({ correct: false });
    render(<MCQQuestion question={q as any} selectedAnswer="bye" onAnswer={() => {}} showResult />);

    // Correct answer text should appear in the summary when incorrect
    expect(screen.getByText(/Correct answer:/)).toBeInTheDocument();
    const helloMatches = screen.getAllByText('hello');
    // one of the matches should be the summary bolded correct answer
    expect(helloMatches.some((el) => el.classList && el.classList.contains('font-medium'))).toBe(true);
  });
});
