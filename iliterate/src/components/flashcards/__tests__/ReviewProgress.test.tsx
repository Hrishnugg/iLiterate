import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReviewProgress } from '@/components/flashcards/ReviewProgress'

describe('ReviewProgress', () => {
  it('shows completed and total card counts', () => {
    render(<ReviewProgress completed={2} total={8} />)

    expect(screen.getByText('2 / 8 cards')).toBeInTheDocument()
  })

  it('shows remaining reviews for free users', () => {
    render(
      <ReviewProgress completed={1} total={5} remainingReviews={9} isPremium={false} />
    )

    expect(screen.getByText('9 reviews left today')).toBeInTheDocument()
  })

  it('hides remaining reviews for premium users', () => {
    render(
      <ReviewProgress completed={1} total={5} remainingReviews={9} isPremium={true} />
    )

    expect(screen.queryByText('9 reviews left today')).not.toBeInTheDocument()
  })

  it('handles zero total without NaN progress', () => {
    render(<ReviewProgress completed={0} total={0} />)

    expect(screen.getByText('0 / 0 cards')).toBeInTheDocument()
  })
})
