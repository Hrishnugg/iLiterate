import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FillBlankQuestion } from '../FillBlankQuestion';

const makeQuestion = (overrides = {}) => ({
  id: 'q1',
  type: 'vocab_fill_blank',
  question: 'Translate: hola',
  context: 'Used in greetings',
  hint: 'Starts with h',
  correct: undefined,
  correct_answer: 'hello',
  ...overrides,
});

describe('FillBlankQuestion', () => {
  it('renders question, context and hint', () => {
    const q = makeQuestion();
    render(<FillBlankQuestion question={q as any} answer="" onAnswer={() => {}} />);

    expect(screen.getByText('Translate: hola')).toBeInTheDocument();
    expect(screen.getByText('Used in greetings')).toBeInTheDocument();
    expect(screen.getByText(/Hint:/)).toBeInTheDocument();
  });

  it('calls onAnswer when typing', () => {
    const q = makeQuestion();
    const onAnswer = vi.fn();
    render(<FillBlankQuestion question={q as any} answer="" onAnswer={onAnswer} />);

    const input = screen.getByPlaceholderText('Type your answer...');
    fireEvent.change(input, { target: { value: 'hello' } });

    expect(onAnswer).toHaveBeenCalledWith('hello');
  });

  it('shows result and correct answer when incorrect', () => {
    const q = makeQuestion({ correct: false });
    render(<FillBlankQuestion question={q as any} answer="no" onAnswer={() => {}} showResult />);

    expect(screen.getByText('Correct answer:')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
