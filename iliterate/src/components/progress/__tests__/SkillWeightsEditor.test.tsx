import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SkillWeightsEditor } from '../SkillWeightsEditor';

describe('SkillWeightsEditor', () => {
  it('applies preset and shows save button, then saves via API', async () => {
    const onUpdate = vi.fn();
    const current = { reading: 0.34, vocabulary: 0.33, grammar: 0.33 };

    // Mock fetch for save
    // @ts-ignore
    global.fetch = vi.fn((url, opts) => {
      if (url === '/api/progress' && opts && opts.method === 'PATCH') {
        return Promise.resolve({ ok: true } as any);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any);
    });

    render(<SkillWeightsEditor currentWeights={current} onUpdate={onUpdate} />);

    // Click a preset button by description
    const presetBtn = screen.getByText('Emphasize reading comprehension');
    fireEvent.click(presetBtn);

    // Save Changes button should appear
    expect(await screen.findByText('Save Changes')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });
  });
});
