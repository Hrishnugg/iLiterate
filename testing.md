# Testing Documentation

## Overview

iLiterate uses [Vitest](https://vitest.dev/) as its test runner with `jsdom` for DOM simulation and React Testing Library for component tests. All tests live inside the `iliterate/` sub-directory.

---

## Test Locations

```
iliterate/src/
├── lib/__tests__/                          # Pure-logic unit tests
│   ├── spaced-repetition.test.ts           # SM-2 algorithm
│   ├── points.test.ts                      # Point calculation helpers
│   ├── level-system.test.ts                # XP thresholds and CEFR mapping
│   ├── quiz-generator.test.ts              # Quiz generation and grading logic
│   ├── validations.fuzz.test.ts            # Fuzz / property-based tests for Zod schemas
│   ├── content-imports.test.ts             # Content import helpers
│   ├── pdf.test.ts                         # PDF extraction utilities
│   ├── study-chat-chunking.test.ts         # Study chat message chunking
│   ├── karaoke-providers.test.ts           # Karaoke provider logic
│   └── karaoke-timing.test.ts             # Karaoke timing calculations
│
├── components/reader/__tests__/            # Reader component tests
│   ├── ArticleRenderer.test.tsx
│   ├── ContentRenderer.test.tsx
│   ├── TextHighlighter.test.tsx
│   ├── TranslatePopover.test.tsx
│   ├── ReadingStats.test.tsx
│   ├── RecentLookupsPanel.test.tsx
│   ├── YourNotesPanel.test.tsx
│   ├── ReaderLayout.test.tsx
│   ├── useReadingProgress.test.tsx
│   └── karaoke.test.ts
│
├── components/flashcards/__tests__/        # Flashcard component tests
│   ├── FlashcardCard.test.tsx
│   ├── FlashcardReview.test.tsx
│   ├── Flashcard.test.tsx
│   ├── Deck.test.tsx
│   ├── ReviewButtons.test.tsx
│   └── ReviewProgress.test.tsx
│
├── components/social/__tests__/           # Social feature tests
│   ├── SocialProfileGate.test.tsx
│   ├── FriendRequestsList.test.tsx
│   └── MessageComposer.test.tsx
│
└── components/lesson/__tests__/           # Lesson component tests
    └── DowngradeLevelDialog.test.tsx
```

---

## What Is Covered

### Pure Logic (`lib/__tests__/`)

| Module | What Is Tested |
|---|---|
| `spaced-repetition.ts` | SM-2 interval calculation for all four response types (again/hard/good/easy), ease factor clamping, new-card bootstrap intervals, `isCardDue` predicate, `daysUntilReview`, `formatInterval`, `calculateIntervalPreview` |
| `points.ts` | Quiz points (proportional, 0–20), perfect-quiz bonus, reading points (word-count scaling), lesson points, flashcard review points, streak bonus (7-day cap) |
| `level-system.ts` | XP thresholds, `checkLevelUp` boundary conditions, CEFR string mapping, weighted overall level calculation |
| `quiz-generator.ts` | `gradeQuiz` with correct/incorrect answers, score and percentage calculation, edge cases (empty answer set) |
| `validations.ts` | Fuzz testing of all Zod schemas with random and adversarial inputs |
| `pdf.ts` | PDF text extraction edge cases |
| `study-chat-chunking.ts` | Message chunking length and boundary behavior |
| `karaoke-providers.ts` / `karaoke-timing.ts` | Provider selection logic and timing offset calculation |

### Components

| Component Group | What Is Tested |
|---|---|
| **Reader** | Article rendering, text highlight creation/deletion, translation popover open/close, reading stats (WPM, progress), recent lookups panel, notes panel, reader layout, karaoke sync |
| **Flashcards** | Card flip animation, review button rendering, response handling (again/hard/good/easy), deck loading/empty states, review progress bar, full review session flow |
| **Social** | Profile visibility gate, friend request accept/decline, DM composer character limit and send |
| **Lesson** | Downgrade level confirmation dialog |

---

## How to Run Tests

All commands are run from the `iliterate/` directory.

```bash
cd iliterate

# Run the full test suite (one-shot)
npm run test

# Run in watch mode (re-runs on file changes during development)
npm run test:watch

# Run only reader component tests
npm run test:reader

# Run a specific test file
npx vitest run src/lib/__tests__/spaced-repetition.test.ts
```

Expected output: all tests should pass. A summary of passed/failed suites is printed to stdout.

---

## Important Limitations

- **No Supabase / database tests** — API routes that call Supabase are not integration-tested. They require a live Supabase instance and valid credentials, which are not committed to the repository. Testing these would require a test-scoped Supabase project and seeded data.

- **No OpenAI / Gemini / ElevenLabs tests** — AI-dependent functions (`generateLesson`, `generateQuiz`, ElevenLabs TTS) are not unit-tested because they make live network calls with non-deterministic output. `quiz-generator.test.ts` covers only the pure `gradeQuiz` function.

- **Browser-only hooks** — `use-mobile.ts` relies on `window.matchMedia` and `window.innerWidth`, which are not available in the jsdom environment. These hooks are untestable without a real browser or extended mocking (see Mutation Testing section below).

- **Next.js server components** — App Router server components and API routes cannot be rendered in Vitest's jsdom environment. Component tests are limited to client components.

---

## CSDS 493 Quality Artifact: Mutation Testing

iLiterate includes a mutation testing suite powered by [Stryker Mutator](https://stryker-mutator.io/) to assess test suite effectiveness beyond simple line coverage.

### What Is Mutation Testing?

Stryker automatically introduces small code changes (mutations) — flipping operators, removing branches, changing constants — and checks whether the test suite catches (kills) each mutation. A high mutation score means the tests would detect real bugs, not just execute code.

### Configuration

The Stryker configuration lives at `iliterate/stryker.config.mjs`. It targets:

- `src/components/flashcards/`
- `src/components/quiz/`
- `src/lib/spaced-repetition.ts`
- `src/lib/quiz-generator.ts`
- `src/hooks/use-mobile.ts`

### Running Mutation Tests

```bash
cd iliterate
npx stryker run
```

> **Note:** Mutation testing is slow — it compiles and reruns the test suite for every mutant. Expect the full run to take 10–30 minutes. Results are saved to `iliterate/reports/mutation/`.

### Results Summary

Full results are in [`iliterate/MUTATION_SCORES.md`](iliterate/MUTATION_SCORES.md). The overall score as of April 2026:

| Group | Score |
|---|---|
| Quiz components | 63.80% |
| Core library modules | 63.95% |
| Flashcard components | 58.25% |
| **Overall** | **60.43%** ✅ |

The break threshold is set at 50%. The `use-mobile.ts` hook scores 0% because `window.matchMedia` is unavailable in jsdom — this is a known limitation documented in `MUTATION_SCORES.md`.

### Browsable Report

An HTML mutation report is generated at `iliterate/reports/mutation/` after running Stryker. Open `index.html` in any browser to explore per-file mutation scores and surviving mutants.

---

## API Documentation

TypeDoc generates browsable HTML documentation for all public library modules. The generated output is committed to `iliterate/api-docs/` in the repository.

```bash
cd iliterate
npm run docs          # regenerate docs → iliterate/api-docs/
```

Open `iliterate/api-docs/index.html` in a browser to browse the API documentation.
