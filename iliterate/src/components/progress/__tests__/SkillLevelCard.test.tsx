import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SkillLevelCard } from '../SkillLevelCard';

describe('SkillLevelCard', () => {
  it('renders skill label, level, progress and XP', () => {
    render(
      <SkillLevelCard
        skill={'reading'}
        level={8}
        xp={120}
        xpToNext={1400}
        progress={20}
        weight={0.34}
      />
    );

    expect(screen.getByText('Reading')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('120 / 1400 XP')).toBeInTheDocument();
    expect(screen.getByText(/Weight:/)).toBeInTheDocument();
  });
});
