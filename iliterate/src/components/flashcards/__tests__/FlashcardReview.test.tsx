import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FlashcardReview } from '@/components/flashcards/FlashcardReview'

vi.mock('@/components/flashcards/FlashcardCard', () => ({
  FlashcardCard: ({ card, onFlip }: { card: { id: string }; onFlip: () => void }) => (
    <div>
      <div data-testid="card-id">{card.id}</div>
      <button onClick={onFlip}>Flip Card</button>
    </div>
  ),
}))

vi.mock('@/components/flashcards/ReviewButtons', () => ({
  ReviewButtons: ({ onResponse }: { onResponse: (r: 'again' | 'hard' | 'good' | 'easy') => void }) => (
    <div>
      <button onClick={() => onResponse('again')}>Again</button>
      <button onClick={() => onResponse('hard')}>Hard</button>
      <button onClick={() => onResponse('good')}>Good</button>
      <button onClick={() => onResponse('easy')}>Easy</button>
    </div>
  ),
}))

const reviewState = {
  cards: [
    {
      id: 'card-1',
      ease_factor: 2.5,
      interval_days: 2,
      repetitions: 1,
      next_review_date: '2026-04-08',
      times_reviewed: 3,
      times_correct: 2,
      context_sentence: null,
      intervalPreview: { again: 1, hard: 3, good: 6, easy: 10 },
      vocabulary: {
        id: 'v1',
        word: 'hola',
        language: 'es',
        pronunciation: null,
        definitions: { translation: 'hello' },
        part_of_speech: 'interj',
      },
    },
  ],
  totalDue: 1,
  limitReached: false,
  dailyReviewsUsed: 0,
  dailyLimit: 20,
  remainingReviews: 20,
  isPremium: false,
}

describe('FlashcardReview', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads and shows review session content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => reviewState,
      })
    )

    render(<FlashcardReview onClose={vi.fn()} />)

    expect(await screen.findByText('Review Session')).toBeInTheDocument()
    expect(screen.getByText('0 / 1 cards')).toBeInTheDocument()
    expect(screen.getByTestId('card-id')).toHaveTextContent('card-1')
  })

  it('submits response after flipping and completes session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => reviewState })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dailyReviewsUsed: 1,
          remainingReviews: 19,
          limitReached: false,
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    render(<FlashcardReview onClose={vi.fn()} />)

    await screen.findByText('Review Session')
    fireEvent.click(screen.getByRole('button', { name: /flip card/i }))
    fireEvent.click(screen.getByRole('button', { name: /^good$/i }))

    await screen.findByText('Session Complete!')

    expect(fetchMock).toHaveBeenCalledWith('/api/vocabulary/review')
    expect(fetchMock).toHaveBeenCalledWith('/api/vocabulary/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: 'card-1', response: 'good' }),
    })
  })

  it('supports keyboard shortcuts for flip and response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => reviewState })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dailyReviewsUsed: 1,
          remainingReviews: 19,
          limitReached: false,
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    render(<FlashcardReview onClose={vi.fn()} />)
    await screen.findByText('Review Session')

    fireEvent.keyDown(window, { key: ' ' })
    fireEvent.keyDown(window, { key: '3' })

    await screen.findByText('Session Complete!')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('renders all-caught-up state when there are no cards', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...reviewState, cards: [] }),
      })
    )

    render(<FlashcardReview onClose={vi.fn()} />)
    expect(await screen.findByText('All caught up!')).toBeInTheDocument()
  })

  it('renders limit reached upgrade state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...reviewState, limitReached: true }),
      })
    )

    render(<FlashcardReview onClose={vi.fn()} />)
    expect(await screen.findByText('Daily Limit Reached')).toBeInTheDocument()
  })

  it('renders error state and retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => reviewState })

    vi.stubGlobal('fetch', fetchMock)

    render(<FlashcardReview onClose={vi.fn()} />)

    await screen.findByText('Failed to fetch cards')
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    await waitFor(() => {
      expect(screen.getByText('Review Session')).toBeInTheDocument()
    })
  })
})
