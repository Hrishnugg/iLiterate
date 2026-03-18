import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DowngradeLevelDialog } from '../DowngradeLevelDialog';

describe('DowngradeLevelDialog', () => {
  it('loads info and allows confirm downgrade', async () => {
    const onOpenChange = vi.fn();
    const onDowngradeComplete = vi.fn();

    // Mock fetch: first GET returns info, second POST returns result
    // @ts-ignore
    global.fetch = vi.fn((url, opts) => {
      if (!opts) {
        // GET
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          canDowngrade: true,
          currentLevel: 8,
          currentCEFR: 'B1',
          targetLevel: 6,
          targetCEFR: 'A2',
          inProgressLessons: 2,
        }) } as any);
      }

      // POST
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ oldCEFR: 'B1', newCEFR: 'A2', lessonsCleared: 2 }) } as any);
    });

    render(<DowngradeLevelDialog open={true} onOpenChange={onOpenChange} onDowngradeComplete={onDowngradeComplete} />);

    // Wait for info text
    await waitFor(() => expect(screen.getByText(/currently at/)).toBeInTheDocument());

    // Confirm Downgrade button
    const confirmBtn = screen.getByText('Confirm Downgrade');
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onDowngradeComplete).toHaveBeenCalled();
  });
});
