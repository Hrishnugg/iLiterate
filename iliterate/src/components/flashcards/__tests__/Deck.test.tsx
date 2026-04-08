import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Deck } from '@/components/flashcards/Deck'

const cardsResponse = [
  {
    id: '1',
    context_sentence: 'El gato duerme.',
    vocabulary: {
      word: 'gato',
      pronunciation: 'GAH-toh',
      definitions: { translation: 'cat', definitions: ['cat'] },
      part_of_speech: 'noun',
    },
  },
  {
    id: '2',
    context_sentence: 'El perro corre.',
    vocabulary: {
      word: 'perro',
      pronunciation: null,
      definitions: { definitions: ['dog'] },
      part_of_speech: null,
    },
  },
  {
    id: '3',
    context_sentence: null,
    vocabulary: {
      word: '',
      pronunciation: null,
      definitions: null,
      part_of_speech: null,
    },
  },
]

describe('Deck', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders loading then cards from API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => cardsResponse,
      })
    )

    render(<Deck contentId="book-1" contentTitle="Book One" />)

    expect(screen.getByText(/loading flashcards/i)).toBeInTheDocument()
    expect(await screen.findByText('Book One')).toBeInTheDocument()
    expect(await screen.findAllByText('gato')).toHaveLength(2)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('shows API error state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => [],
      })
    )

    render(<Deck contentId="book-2" />)

    expect(await screen.findByText('Failed to fetch vocabulary')).toBeInTheDocument()
  })

  it('shows empty state when no saved vocabulary exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
    )

    render(<Deck contentId="book-3" />)

    expect(await screen.findByText('No flashcards found')).toBeInTheDocument()
  })

  it('navigates between cards and flips with keyboard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => cardsResponse,
      })
    )

    const { container } = render(<Deck contentId="book-4" />)

    await screen.findAllByText('gato')

    const navButtons = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('data-size') === 'icon')
    fireEvent.click(navButtons[1])

    await waitFor(() => {
      expect(screen.getAllByText('perro').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('2 / 2')).toBeInTheDocument()
    })

    const flipRegion = container.querySelector('[role="button"][tabindex="0"]')
    expect(flipRegion).toBeTruthy()
    if (!flipRegion) throw new Error('Expected flip region')

    fireEvent.keyDown(flipRegion, { key: 'Enter' })
    fireEvent.keyDown(flipRegion, { key: ' ' })

    expect(screen.getByText(/Press Space or Enter to flip/i)).toBeInTheDocument()
  })

  it('prev button is disabled at index 0; next button is disabled at the last card', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => cardsResponse })
    )
    render(<Deck contentId="book-5" />)
    await screen.findAllByText('gato')

    const navButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('data-size') === 'icon')

    expect(navButtons[0]).toBeDisabled()
    expect(navButtons[1]).not.toBeDisabled()

    fireEvent.click(navButtons[1])
    await waitFor(() => expect(screen.getByText('2 / 2')).toBeInTheDocument())

    expect(navButtons[0]).not.toBeDisabled()
    expect(navButtons[1]).toBeDisabled()
  })

  it('navigates back to the first card with the prev button', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => cardsResponse })
    )
    render(<Deck contentId="book-6" />)
    await screen.findAllByText('gato')

    const navButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('data-size') === 'icon')

    fireEvent.click(navButtons[1])
    await waitFor(() => expect(screen.getByText('2 / 2')).toBeInTheDocument())

    fireEvent.click(navButtons[0])
    await waitFor(() => expect(screen.getByText('1 / 2')).toBeInTheDocument())
  })

  it('clicking the card div flips the card and clicking again restores it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => cardsResponse })
    )
    const { container } = render(<Deck contentId="book-7" />)
    await screen.findAllByText('gato')

    const flipRegion = container.querySelector(
      '[role="button"][tabindex="0"]'
    ) as HTMLElement
    const innerFlipDiv = flipRegion.firstElementChild as HTMLElement

    expect(innerFlipDiv).toHaveStyle({ transform: 'rotateY(0deg)' })

    fireEvent.click(flipRegion)
    await waitFor(() =>
      expect(innerFlipDiv).toHaveStyle({ transform: 'rotateY(180deg)' })
    )

    fireEvent.click(flipRegion)
    await waitFor(() =>
      expect(innerFlipDiv).toHaveStyle({ transform: 'rotateY(0deg)' })
    )
  })

  it('shows definitions[0] as translation on back when no translation property', async () => {
    const card = {
      id: '10',
      context_sentence: null,
      vocabulary: {
        word: 'perro',
        pronunciation: null,
        definitions: { definitions: ['dog'] },
        part_of_speech: null,
      },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [card] })
    )
    const { container } = render(<Deck contentId="book-8" />)
    await screen.findAllByText('perro')

    const flipRegion = container.querySelector(
      '[role="button"][tabindex="0"]'
    ) as HTMLElement
    fireEvent.click(flipRegion)

    await waitFor(() => expect(screen.getByText('dog')).toBeInTheDocument())
  })

  it('shows "No translation" on back when definitions are null', async () => {
    const card = {
      id: '11',
      context_sentence: null,
      vocabulary: {
        word: 'unknown',
        pronunciation: null,
        definitions: null,
        part_of_speech: null,
      },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [card] })
    )
    const { container } = render(<Deck contentId="book-9" />)
    await screen.findAllByText('unknown')

    const flipRegion = container.querySelector(
      '[role="button"][tabindex="0"]'
    ) as HTMLElement
    fireEvent.click(flipRegion)

    await waitFor(() =>
      expect(screen.getByText('No translation')).toBeInTheDocument()
    )
  })

  it('shows pronunciation, part of speech, and context sentence on back after flip', async () => {
    const card = cardsResponse[0]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [card] })
    )
    const { container } = render(<Deck contentId="book-10" />)
    await screen.findAllByText('gato')

    const flipRegion = container.querySelector(
      '[role="button"][tabindex="0"]'
    ) as HTMLElement
    fireEvent.click(flipRegion)

    await waitFor(() => {
      expect(screen.getAllByText('GAH-toh').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('noun')).toBeInTheDocument()
      expect(screen.getAllByText(/El gato duerme/i).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('hides contentTitle paragraph when no title prop is given', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => cardsResponse })
    )
    render(<Deck contentId="book-11" />)
    await screen.findAllByText('gato')
    expect(screen.queryByText('Book One')).not.toBeInTheDocument()
  })
})
