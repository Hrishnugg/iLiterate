import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UpgradePrompt } from '@/components/flashcards/UpgradePrompt'

describe('UpgradePrompt', () => {
  it('renders limit messaging and tier information', () => {
    render(
      <UpgradePrompt dailyReviewsUsed={20} dailyLimit={20} onClose={vi.fn()} />
    )

    expect(screen.getByText('Daily Limit Reached')).toBeInTheDocument()
    expect(screen.getByText(/You've reviewed 20 cards today/i)).toBeInTheDocument()
    expect(screen.getByText('Free tier: 20 reviews per day')).toBeInTheDocument()
  })

  it('calls onClose when done button is clicked', () => {
    const onClose = vi.fn()
    render(
      <UpgradePrompt dailyReviewsUsed={20} dailyLimit={20} onClose={onClose} />
    )

    fireEvent.click(screen.getByRole('button', { name: /done for today/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
