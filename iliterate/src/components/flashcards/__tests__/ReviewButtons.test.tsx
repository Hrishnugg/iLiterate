import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReviewButtons } from '@/components/flashcards/ReviewButtons'

describe('ReviewButtons', () => {
  const mockOnResponse = vi.fn()
  const intervalPreview = {
    again: 1,
    hard: 3,
    good: 6,
    easy: 12
  }

  beforeEach(() => {
    mockOnResponse.mockClear()
  })

  it('should render all four buttons', () => {
    render(
      <ReviewButtons
        intervalPreview={intervalPreview}
        onResponse={mockOnResponse}
      />
    )

    expect(screen.getByText('Again')).toBeInTheDocument()
    expect(screen.getByText('Hard')).toBeInTheDocument()
    expect(screen.getByText('Good')).toBeInTheDocument()
    expect(screen.getByText('Easy')).toBeInTheDocument()
  })

  it('should display interval previews', () => {
    render(
      <ReviewButtons
        intervalPreview={intervalPreview}
        onResponse={mockOnResponse}
      />
    )

    expect(screen.getByText('1d')).toBeInTheDocument() // again
    expect(screen.getByText('3d')).toBeInTheDocument() // hard
    expect(screen.getByText('6d')).toBeInTheDocument() // good
    expect(screen.getByText('2w')).toBeInTheDocument() // easy (12 days = 2 weeks)
  })

  it('should call onResponse with correct response when button clicked', () => {
    render(
      <ReviewButtons
        intervalPreview={intervalPreview}
        onResponse={mockOnResponse}
      />
    )

    fireEvent.click(screen.getByText('Again'))
    expect(mockOnResponse).toHaveBeenCalledWith('again')

    fireEvent.click(screen.getByText('Hard'))
    expect(mockOnResponse).toHaveBeenCalledWith('hard')

    fireEvent.click(screen.getByText('Good'))
    expect(mockOnResponse).toHaveBeenCalledWith('good')

    fireEvent.click(screen.getByText('Easy'))
    expect(mockOnResponse).toHaveBeenCalledWith('easy')
  })

  it('should disable buttons when disabled prop is true', () => {
    render(
      <ReviewButtons
        intervalPreview={intervalPreview}
        onResponse={mockOnResponse}
        disabled={true}
      />
    )

    const againButton = screen.getByRole('button', { name: /again/i })
    expect(againButton).toBeDisabled()

    fireEvent.click(againButton)
    expect(mockOnResponse).not.toHaveBeenCalled()
  })

  it('should enable buttons when disabled prop is false or undefined', () => {
    render(
      <ReviewButtons
        intervalPreview={intervalPreview}
        onResponse={mockOnResponse}
        disabled={false}
      />
    )

    const againButton = screen.getByText('Again')
    expect(againButton).not.toBeDisabled()
  })
})