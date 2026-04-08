import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FlashcardCard } from '@/components/flashcards/FlashcardCard'

const baseCard = {
  id: 'u1',
  ease_factor: 2.5,
  interval_days: 3,
  repetitions: 2,
  next_review_date: '2026-04-08',
  times_reviewed: 10,
  times_correct: 7,
  context_sentence: 'Ella lee un libro.',
  intervalPreview: {
    again: 1,
    hard: 3,
    good: 6,
    easy: 12,
  },
  vocabulary: {
    id: 'v1',
    word: 'libro',
    language: 'es',
    pronunciation: 'LEE-broh',
    definitions: {
      translation: 'book',
      definitions: ['book', 'volume', 'manual'],
    },
    part_of_speech: 'noun',
  },
}

describe('FlashcardCard', () => {
  it('renders front content and hint controls', () => {
    render(<FlashcardCard card={baseCard} isFlipped={false} onFlip={vi.fn()} />)

    expect(screen.getAllByText('libro').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: /pronunciation/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hint/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument()
  })

  it('calls onFlip from container click only when not flipped', () => {
    const onFlip = vi.fn()
    const { container, rerender } = render(
      <FlashcardCard card={baseCard} isFlipped={false} onFlip={onFlip} />
    )

    const clickable = container.querySelector('.transform-style-3d')
    expect(clickable).toBeTruthy()
    if (!clickable) throw new Error('Expected clickable card container')

    fireEvent.click(clickable)
    expect(onFlip).toHaveBeenCalledTimes(1)

    rerender(<FlashcardCard card={baseCard} isFlipped={true} onFlip={onFlip} />)
    fireEvent.click(clickable)
    expect(onFlip).toHaveBeenCalledTimes(1)
  })

  it('toggles pronunciation and hint content', () => {
    render(<FlashcardCard card={baseCard} isFlipped={false} onFlip={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /pronunciation/i }))
    expect(screen.getAllByText('LEE-broh').length).toBeGreaterThanOrEqual(1)

    fireEvent.click(screen.getByRole('button', { name: /hint/i }))
    expect(screen.getAllByText(/ella lee un libro/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renders back-side details when flipped', () => {
    render(<FlashcardCard card={baseCard} isFlipped={true} onFlip={vi.fn()} />)

    expect(screen.getByText('book')).toBeInTheDocument()
    expect(screen.getByText('noun')).toBeInTheDocument()
    expect(screen.getByText('volume')).toBeInTheDocument()
    expect(screen.getByText('manual')).toBeInTheDocument()
    expect(screen.getByText(/Reviewed 10 times \(7 correct\)/i)).toBeInTheDocument()
  })

  it('falls back to first definition when translation is missing', () => {
    const card = {
      ...baseCard,
      vocabulary: {
        ...baseCard.vocabulary,
        definitions: {
          definitions: ['fallback definition'],
        },
      },
    }

    render(<FlashcardCard card={card} isFlipped={true} onFlip={vi.fn()} />)
    expect(screen.getByText('fallback definition')).toBeInTheDocument()
  })

  it('shows "No translation" when definitions object is empty', () => {
    const card = {
      ...baseCard,
      vocabulary: { ...baseCard.vocabulary, definitions: {} },
    }
    render(<FlashcardCard card={card} isFlipped={true} onFlip={vi.fn()} />)
    expect(screen.getByText('No translation')).toBeInTheDocument()
  })

  it('second pronunciation click hides the pronunciation text', () => {
    render(<FlashcardCard card={baseCard} isFlipped={false} onFlip={vi.fn()} />)
    const pronBtn = screen.getByRole('button', { name: /pronunciation/i })

    // First click — front shows pronunciation → total 2 (front + invisible back)
    fireEvent.click(pronBtn)
    expect(screen.getAllByText('LEE-broh')).toHaveLength(2)

    // Second click — front hides it → back to 1 (only invisible back card)
    fireEvent.click(pronBtn)
    expect(screen.getAllByText('LEE-broh')).toHaveLength(1)
  })

  it('second hint click hides the context sentence', () => {
    render(<FlashcardCard card={baseCard} isFlipped={false} onFlip={vi.fn()} />)
    const hintBtn = screen.getByRole('button', { name: /hint/i })

    fireEvent.click(hintBtn)
    expect(screen.getAllByText(/ella lee un libro/i)).toHaveLength(2)

    fireEvent.click(hintBtn)
    expect(screen.getAllByText(/ella lee un libro/i)).toHaveLength(1)
  })

  it('does not render pronunciation button when pronunciation is null', () => {
    const card = {
      ...baseCard,
      vocabulary: { ...baseCard.vocabulary, pronunciation: null },
    }
    render(<FlashcardCard card={card} isFlipped={false} onFlip={vi.fn()} />)
    expect(
      screen.queryByRole('button', { name: /pronunciation/i })
    ).not.toBeInTheDocument()
  })

  it('does not render hint button when context_sentence is null', () => {
    const card = { ...baseCard, context_sentence: null }
    render(<FlashcardCard card={card} isFlipped={false} onFlip={vi.fn()} />)
    expect(
      screen.queryByRole('button', { name: /hint/i })
    ).not.toBeInTheDocument()
  })

  it('does not render part_of_speech badge when part_of_speech is null', () => {
    const card = {
      ...baseCard,
      vocabulary: { ...baseCard.vocabulary, part_of_speech: null },
    }
    render(<FlashcardCard card={card} isFlipped={true} onFlip={vi.fn()} />)
    expect(screen.queryByText('noun')).not.toBeInTheDocument()
  })

  it('does not render additional definitions when only one definition exists', () => {
    const card = {
      ...baseCard,
      vocabulary: {
        ...baseCard.vocabulary,
        definitions: { translation: 'book', definitions: ['book'] },
      },
    }
    render(<FlashcardCard card={card} isFlipped={true} onFlip={vi.fn()} />)
    expect(screen.queryByText('volume')).not.toBeInTheDocument()
    expect(screen.queryByText('manual')).not.toBeInTheDocument()
  })

  it('shows context sentence on the back side when flipped', () => {
    render(<FlashcardCard card={baseCard} isFlipped={true} onFlip={vi.fn()} />)
    expect(
      screen.getAllByText(/ella lee un libro/i).length
    ).toBeGreaterThanOrEqual(1)
  })

  it('pronunciation and hint buttons do not trigger onFlip via bubbling', () => {
    const onFlip = vi.fn()
    render(<FlashcardCard card={baseCard} isFlipped={false} onFlip={onFlip} />)

    fireEvent.click(screen.getByRole('button', { name: /pronunciation/i }))
    fireEvent.click(screen.getByRole('button', { name: /hint/i }))

    expect(onFlip).not.toHaveBeenCalled()
  })
})
