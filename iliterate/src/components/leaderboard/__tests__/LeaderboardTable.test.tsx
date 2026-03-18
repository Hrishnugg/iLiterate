import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LeaderboardTable } from '../LeaderboardTable';

const makeEntry = (overrides = {}) => ({
  rank: 1,
  userId: 'u1',
  displayName: 'Alice',
  points: 1000,
  ...overrides,
});

describe('LeaderboardTable', () => {
  it('shows empty message when no entries', () => {
    render(<LeaderboardTable entries={[]} currentUserId="" />);
    expect(
      screen.getByText(/No activity this period yet/i)
    ).toBeInTheDocument();
  });

  it('renders entries with medals, labels and formatted points, and highlights current user', () => {
    const entries = [
      makeEntry({ rank: 1, userId: 'u1', displayName: 'Top', points: 12345 }),
      makeEntry({ rank: 2, userId: 'u2', displayName: 'Second', points: 2345 }),
      makeEntry({ rank: 3, userId: 'u3', displayName: 'Third', points: 345 }),
      makeEntry({ rank: 4, userId: 'me', displayName: 'Me', points: 45 }),
    ];

    render(<LeaderboardTable entries={entries} currentUserId="me" />);

    // Rank 1 should show medal emoji
    expect(screen.getByText('\u{1F947}')).toBeInTheDocument();
    // Rank 2 and 3 should show their emoji as well
    expect(screen.getByText('\u{1F948}')).toBeInTheDocument();
    expect(screen.getByText('\u{1F949}')).toBeInTheDocument();

    // For rank 4 (no emoji) the rank label should be the number '4' shown in the left circle
    const meNode = screen.getByText('Me');
    expect(meNode).toBeInTheDocument();
    const rankNode = meNode.parentElement?.previousElementSibling as HTMLElement | null;
    expect(rankNode).not.toBeNull();
    expect(rankNode?.textContent).toContain('4');

    // Points formatting — use locale formatting to match component
    expect(screen.getByText(`${(12345).toLocaleString()} pts`)).toBeInTheDocument();
    expect(screen.getByText(`${(2345).toLocaleString()} pts`)).toBeInTheDocument();

    // Current user should show '(you)' and container should have ring-primary class
    expect(screen.getByText(/\(you\)/)).toBeInTheDocument();
    const youLabel = screen.getByText(/\(you\)/);
    // Walk up to find the container with ring-primary
    let el: HTMLElement | null = youLabel;
    let found = false;
    for (let i = 0; i < 5 && el; i++) {
      el = el.parentElement;
      if (!el) break;
      if (el.className && el.className.includes('ring-primary')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
