import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { within } from '@testing-library/react';
import { OverallProgressCard } from '../OverallProgressCard';

describe('OverallProgressCard', () => {
  it('renders level, CEFR and skill levels', () => {
    const { container } = render(
      <OverallProgressCard
        level={7}
        cefr={'B1'}
        skillLevels={{ reading: 7, vocabulary: 5, grammar: 6 }}
      />
    );

    const article = screen.getByRole('article');
    expect(within(article).getByText('Overall Level')).toBeInTheDocument();
    expect(within(article).getByText('B1')).toBeInTheDocument();
    // Big overall level number should be the large header (text-3xl)
    const bigNumber = container.querySelector('.text-3xl');
    expect(bigNumber).toBeTruthy();
    expect(bigNumber).toHaveTextContent('7');
    // Skill labels are in the skill group
    expect(within(article).getByText('Reading')).toBeInTheDocument();
    expect(within(article).getByText('Vocabulary')).toBeInTheDocument();
    expect(within(article).getByText('Grammar')).toBeInTheDocument();
  });
});
