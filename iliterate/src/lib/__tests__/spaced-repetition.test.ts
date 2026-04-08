import { describe, it, expect } from 'vitest'
import { calculateNextReview, formatInterval, DEFAULT_EASE_FACTOR, type ResponseQuality } from '@/lib/spaced-repetition'

describe('Spaced Repetition Algorithm', () => {
  describe('calculateNextReview', () => {
    it('should handle "again" response correctly', () => {
      const result = calculateNextReview(DEFAULT_EASE_FACTOR, 10, 3, 'again')

      expect(result.newEaseFactor).toBe(2.3) // 2.5 - 0.2
      expect(result.newInterval).toBe(1)
      expect(result.newRepetitions).toBe(0)
      expect(result.nextReviewDate).toBeInstanceOf(Date)
    })

    it('should handle "hard" response correctly', () => {
      const result = calculateNextReview(DEFAULT_EASE_FACTOR, 10, 3, 'hard')

      expect(result.newEaseFactor).toBe(2.35) // 2.5 - 0.15
      expect(result.newInterval).toBe(12) // Math.round(10 * 1.2)
      expect(result.newRepetitions).toBe(3) // unchanged
    })

    it('should handle "good" response for new card (repetitions = 0)', () => {
      const result = calculateNextReview(DEFAULT_EASE_FACTOR, 1, 0, 'good')

      expect(result.newEaseFactor).toBe(2.5) // unchanged
      expect(result.newInterval).toBe(1)
      expect(result.newRepetitions).toBe(1)
    })

    it('should handle "good" response for first repetition (repetitions = 1)', () => {
      const result = calculateNextReview(DEFAULT_EASE_FACTOR, 1, 1, 'good')

      expect(result.newEaseFactor).toBe(2.5) // unchanged
      expect(result.newInterval).toBe(6)
      expect(result.newRepetitions).toBe(2)
    })

    it('should handle "good" response for established card (repetitions >= 2)', () => {
      const result = calculateNextReview(DEFAULT_EASE_FACTOR, 6, 2, 'good')

      expect(result.newEaseFactor).toBe(2.5) // unchanged
      expect(result.newInterval).toBe(15) // Math.round(6 * 2.5)
      expect(result.newRepetitions).toBe(3)
    })

    it('should handle "easy" response for new card (repetitions = 0)', () => {
      const result = calculateNextReview(DEFAULT_EASE_FACTOR, 1, 0, 'easy')

      expect(result.newEaseFactor).toBe(2.65) // 2.5 + 0.15
      expect(result.newInterval).toBe(4) // Skip ahead for easy new cards
      expect(result.newRepetitions).toBe(1)
    })

    it('should handle "easy" response for first repetition (repetitions = 1)', () => {
      const result = calculateNextReview(DEFAULT_EASE_FACTOR, 1, 1, 'easy')

      expect(result.newEaseFactor).toBe(2.65) // 2.5 + 0.15
      expect(result.newInterval).toBe(8) // Math.round(6 * 1.3)
      expect(result.newRepetitions).toBe(2)
    })

    it('should handle "easy" response for established card (repetitions >= 2)', () => {
      const result = calculateNextReview(DEFAULT_EASE_FACTOR, 6, 2, 'easy')

      expect(result.newEaseFactor).toBe(2.65) // 2.5 + 0.15
      expect(result.newInterval).toBe(20) // Math.round(6 * 2.5 * 1.3)
      expect(result.newRepetitions).toBe(3)
    })

    it('should not allow ease factor below minimum', () => {
      const result = calculateNextReview(1.4, 10, 3, 'again')

      expect(result.newEaseFactor).toBe(1.3) // clamped to MIN_EASE_FACTOR
    })

    it('should round ease factor to 2 decimal places', () => {
      const result = calculateNextReview(2.534, 10, 3, 'hard')

      expect(result.newEaseFactor).toBe(2.38) // 2.534 - 0.15 = 2.384, rounded to 2.38
    })

    it('should calculate next review date correctly', () => {
      const now = new Date()
      const result = calculateNextReview(DEFAULT_EASE_FACTOR, 1, 0, 'good')

      const expectedDate = new Date(now)
      expectedDate.setDate(now.getDate() + 1)

      expect(result.nextReviewDate.toDateString()).toBe(expectedDate.toDateString())
    })
  })

  describe('formatInterval', () => {
    it('should format days correctly', () => {
      expect(formatInterval(0.5)).toBe('<1d')
      expect(formatInterval(1)).toBe('1d')
      expect(formatInterval(3)).toBe('3d')
      expect(formatInterval(6)).toBe('6d')
    })

    it('should format weeks correctly', () => {
      expect(formatInterval(7)).toBe('1w')
      expect(formatInterval(10)).toBe('1w') // rounded
      expect(formatInterval(14)).toBe('2w')
    })

    it('should format months correctly', () => {
      expect(formatInterval(30)).toBe('1mo')
      expect(formatInterval(60)).toBe('2mo')
      expect(formatInterval(90)).toBe('3mo')
    })

    it('should format years correctly', () => {
      expect(formatInterval(365)).toBe('1y')
      expect(formatInterval(730)).toBe('2y')
      expect(formatInterval(547.5)).toBe('1.5y') // 547.5 / 365 ≈ 1.5
    })
  })

  describe('edge cases', () => {
    it('should handle minimum interval for hard response', () => {
      const result = calculateNextReview(DEFAULT_EASE_FACTOR, 1, 3, 'hard')

      expect(result.newInterval).toBe(1) // Math.max(1, Math.round(1 * 1.2)) = 1
    })

    it('should handle very high ease factor', () => {
      const result = calculateNextReview(5.0, 10, 3, 'good')

      expect(result.newInterval).toBe(50) // Math.round(10 * 5.0)
    })
  })
})