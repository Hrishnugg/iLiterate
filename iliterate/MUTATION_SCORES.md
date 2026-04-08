# Mutation Testing Score Summary

**Run date:** April 7, 2026  
**Tool:** Stryker Mutator (vitest runner)  
**Break threshold:** 50%  
**Overall score:** 60.43% ✅

---

## By Component

### Flashcard Components (`src/components/flashcards/`)

| File | Killed | Survived | Score |
|------|--------|----------|-------|
| UpgradePrompt.tsx | 1 | 0 | **100.00%** |
| Flashcard.tsx | 19 | 2 | **90.48%** |
| ReviewButtons.tsx | 17 | 9 | **65.38%** |
| FlashcardReview.tsx | 87 | 67 | **56.49%** |
| ReviewProgress.tsx | 8 | 8 | **50.00%** |
| FlashcardCard.tsx | 51 | 31 | **62.20%** |
| Deck.tsx | 58 | 55 | **51.33%** |

### Quiz Components (`src/components/quiz/`)

| File | Killed | Survived | Score |
|------|--------|----------|-------|
| QuizResults.tsx | 34 | 9 | **79.07%** |
| FillBlankQuestion.tsx | 31 | 9 | **77.50%** |
| MCQQuestion.tsx | 70 | 37 | **65.42%** |
| QuizContainer.tsx | 74 | 60 | **55.22%** |

### Library (`src/lib/`)

| File | Killed | Survived | Score |
|------|--------|----------|-------|
| spaced-repetition.ts | 81 | 22 | **78.64%** |
| quiz-generator.ts | 84 | 71 | **54.19%** |

### Hooks (`src/hooks/`)

| File | Killed | Survived | Score |
|------|--------|----------|-------|
| use-mobile.ts | 0 | 19 | **0.00%** |

> `use-mobile.ts` is a React hook that depends on `window.matchMedia` and `window.innerWidth`. These browser-only APIs are not available in the jsdom test environment without additional mocking, so no mutants are covered.

---

## Aggregate by Group

| Group | Score |
|-------|-------|
| Quiz components | 63.80% |
| Library | 63.95% |
| Flashcard components | 58.25% |
| Hooks | 0.00% |
| **All files** | **60.43%** |

---

## Test File Scores

These reflect mutation coverage produced by each test file itself.

| Test File | Killed | Survived | Score |
|-----------|--------|----------|-------|
| FlashcardReview.test.tsx | 79 | 43 | 64.75% |
| Flashcard.test.tsx | 35 | 19 | 64.81% |
| QuizContainer.test.tsx | 80 | 48 | 62.50% |
| ReviewButtons.test.tsx | 22 | 13 | 62.86% |
| FlashcardCard.test.tsx | 56 | 64 | 46.67% |
| FillBlankQuestion.test.tsx | 22 | 17 | 56.41% |
| MCQQuestion.test.tsx | 58 | 24 | 70.73% |
| QuizResults.test.tsx | 31 | 23 | 57.41% |
| Deck.test.tsx | 111 | 70 | 61.33% |
| ReviewProgress.test.tsx | 6 | 10 | 37.50% |
| UpgradePrompt.test.tsx | 4 | 6 | 40.00% |
