# iLiterate

A language learning platform combining reading comprehension with spaced repetition flashcards, built with Next.js, React, and Supabase.

## Major Workflow and Architecture

### Tech Stack
- **Frontend**: Next.js 16 (App Router, React 19, TypeScript)
- **Styling**: Tailwind CSS 4 + shadcn/ui (Radix primitives)
- **Backend**: Supabase (PostgreSQL + Auth + Row Level Security)
- **AI Content Generation**: OpenAI GPT-4o-mini for lessons and quizzes
- **AI Translation**: Google Gemini API
- **TTS**: ElevenLabs API for reader audio and flashcard pronunciation
- **NLP Sidecar**: FastAPI Python service (wordfreq + Lindera) for word difficulty and CJK tokenization
- **Testing**: Vitest + React Testing Library + Stryker (mutation testing) + fast-check (property-based testing)

### Key Features and Design Choices

1. **Spaced Repetition (SM-2 Algorithm)** — `src/lib/spaced-repetition.ts`
   Implements the SuperMemo SM-2 algorithm (same as Anki). Cards have an ease factor, interval, and repetition count. User responses (again/hard/good/easy) adjust these values to schedule optimal review times. We chose SM-2 for its proven effectiveness and simplicity.

2. **Leveling and XP System** — `src/lib/level-system.ts`
   20-level progression mapped to CEFR tiers (A1-C2). XP is awarded for quizzes, reading, and flashcard reviews with challenge bonuses for harder content. The system includes content recommendation, level downgrades, and weighted skill tracking across reading/vocabulary/grammar.

3. **AI-Generated Content** — `src/lib/quiz-generator.ts`, `src/lib/lesson-generator.ts`
   OpenAI generates quizzes and lessons tailored to the user's CEFR level. Prompts include level-specific guidelines so generated content matches the learner's proficiency. Quizzes are graded with exact-match scoring.

4. **Input Validation** — `src/lib/validations.ts`
   All API request bodies are validated with Zod schemas before processing. This includes translation requests, TTS requests, vocabulary entries, reading progress, and highlights. The `validateRequestBody` helper provides consistent error formatting.

5. **Points and Gamification** — `src/lib/points.ts`
   An immutable `point_events` log tracks all XP awards. Streak tracking with daily bonuses incentivizes consistent practice. Leaderboard SQL functions aggregate points weekly/monthly using SECURITY DEFINER to bypass RLS.

6. **Supabase Auth and Security** — Three distinct Supabase clients (browser, SSR, admin) with Row Level Security ensuring users only access their own data. Cross-user features (leaderboard, social) use SECURITY DEFINER functions.

### Directory Structure
```
iliterate/src/
├── app/              # Next.js App Router pages
│   ├── (auth)/       # Login, signup, onboarding
│   ├── (dashboard)/  # Reader, flashcards, library, quizzes, profile
│   └── api/          # Route handlers
├── components/       # React components (reader, flashcards, quiz, social, etc.)
├── lib/              # Core business logic
│   ├── spaced-repetition.ts   # SM-2 algorithm
│   ├── level-system.ts        # XP and leveling
│   ├── quiz-generator.ts      # AI quiz generation
│   ├── lesson-generator.ts    # AI lesson generation
│   ├── validations.ts         # Zod schemas
│   ├── points.ts              # Point calculations
│   └── supabase/              # DB clients
└── types/            # TypeScript type definitions
```

## Testing and Quality Assurance

### Test Suite Summary

**245 total tests** across 33 test files (243 passing, 2 pre-existing failures in FlashcardCard component).

```bash
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run test:reader    # Reader component tests only
```

### Advanced Testing Methods Applied

#### 1. Mutation Testing (Stryker) — Spaced Repetition + Level System

**Tool**: [@stryker-mutator/core](https://stryker-mutator.io/) with vitest-runner

Mutation testing injects faults (mutants) into source code and checks whether the test suite catches them. A killed mutant means the tests detected the fault; a surviving mutant means there's a gap.

**Results**:

| File | Mutation Score | Killed | Survived | Timeouts |
|------|---------------|--------|----------|----------|
| `spaced-repetition.ts` | **98.06%** | 101 | 2 | 0 |
| `level-system.ts` | **64.72%** | 219 | 121 | 3 |
| **Total** | **72.42%** | **320** | **123** | **3** |

- `spaced-repetition.ts` achieved near-perfect mutation score (98%), meaning virtually every code path and constant is exercised by tests. The 2 survivors are the `days === 1` special case in `formatInterval` (covered but with a redundant branch) and a `setHours`/`setMinutes` equivalence.
- `level-system.ts` survivors are predominantly string literals in `LEVEL_DESCRIPTIONS` (a 20-entry lookup table of human-readable text), which are intentionally not tested for exact content.

Run mutation testing:
```bash
npx stryker run
# Report: reports/mutation/mutation-report.html
```

#### 2. Property-Based / Fuzz Testing (fast-check) — Validations

**Tool**: [fast-check](https://github.com/dubzzz/fast-check)

Property-based testing generates thousands of random inputs to verify invariants hold universally, not just for hand-picked cases. This is particularly effective for input validation schemas.

**Applied to**: `src/lib/validations.ts` (33 tests)

Key properties verified:
- **UUID schema**: All valid v4 UUIDs accepted (500 random UUIDs), all non-UUID strings rejected (500 random strings)
- **Language schema**: All 2-3 letter ISO code patterns accepted, never throws on arbitrary input (1000 random values of any type)
- **Translation requests**: Valid requests with random text always accepted; boundary violations always rejected
- **TTS/Vocabulary/Progress schemas**: Random valid inputs accepted; boundary values rejected
- **Schema safety**: No schema ever throws an exception on any input type (fuzz tested with `fc.anything()`)

#### 3. Mock-Object Testing — Quiz Generator

**Feature**: `src/lib/quiz-generator.ts`

The quiz generator depends on OpenAI's API. Mock-object testing isolates the business logic by replacing the OpenAI client with a mock:

- **Response parsing**: Verifies JSON array extraction from AI responses
- **Error handling**: Confirms proper error messages for non-JSON and malformed responses
- **ID assignment**: Verifies fallback IDs when AI omits them
- **Prompt construction**: Validates that saved vocabulary and level-appropriate language settings are included in prompts
- **Grade calculation**: Tests the pure `gradeQuiz` function for correct/wrong/partial/missing answers and case sensitivity

#### 4. Regression Testing — SM-2 Algorithm Progression

Pinned expected outputs for a realistic card learning sequence:
```
New card → good → good → good → good
Interval:    1d     6d    15d    38d
```
This regression test locks in the algorithm's behavior and will catch any accidental changes to the SM-2 implementation.

### Test Coverage by Module

| Module | Tests | Method |
|--------|-------|--------|
| Spaced Repetition (SM-2) | 38 | Unit + Regression + Mutation |
| Level System (XP/CEFR) | 57 | Unit + Boundary + Mutation |
| Validations (Zod schemas) | 33 | Property-based + Fuzz |
| Quiz Generator (OpenAI) | 14 | Mock-object |
| Points Calculation | 20 | Unit (pre-existing) |
| Reader Components | 7 files | Component (pre-existing) |
| Flashcard Components | 5 files | Component (pre-existing) |
| Quiz Components | 4 files | Component (pre-existing) |
| Social Components | 3 files | Component (pre-existing) |
| Progress Components | 3 files | Component (pre-existing) |

## How AI Assisted Development

**Claude Code** (Anthropic's AI coding agent) was the primary AI tool used throughout development. Specific contributions:

1. **Test Suite Creation**: Claude Code wrote the comprehensive test suites for spaced-repetition, level-system, validations, and quiz-generator modules, including selecting appropriate testing strategies for each module.

2. **Mutation Testing Setup**: Claude Code configured Stryker mutation testing (stryker.config.mjs) and iteratively improved tests to maximize mutation kill rate, achieving 98% on the SM-2 algorithm.

3. **Property-Based Testing**: Claude Code designed property-based tests using fast-check, identifying key invariants like "schemas never throw on arbitrary input" and "all valid UUIDs are accepted."

4. **Bug Detection**: The mock-object tests for quiz-generator exposed edge cases in JSON parsing and prompt construction that were not covered by manual testing.

5. **Architecture and Code Quality**: Claude Code helped maintain consistent patterns across the codebase (API route auth pattern, Supabase client usage, Zod validation) and identified potential issues during code review.

## Quality and Correctness Verification

1. **Automated Testing**: 243+ passing tests across unit, component, property-based, mock-object, and regression methods
2. **Mutation Testing**: 72.42% overall mutation score (320 mutants killed), 98% on core SM-2 algorithm
3. **Fuzz Testing**: 1000+ random inputs tested against validation schemas with zero exceptions
4. **Type Safety**: Full TypeScript with strict mode, Zod runtime validation at API boundaries
5. **Security**: Row Level Security on all Supabase tables, SECURITY DEFINER for cross-user queries, input validation on all API routes
6. **Code Modularity**: Core logic (SM-2, XP, grading) is pure functions, separated from side effects (DB, API calls), enabling isolated testing

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- A Supabase project with migrations applied (`supabase/migrations/`)

### Environment Variables

Create a `.env.local` file in the `iliterate/` directory:

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
GOOGLE_AI_API_KEY=<your-google-ai-api-key>
OPENAI_API_KEY=<your-openai-api-key>
ELEVENLABS_API_KEY=<your-elevenlabs-api-key>
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
NEXT_PUBLIC_APP_URL=http://localhost:3000
PYTHON_API_BASE_URL=http://localhost:8000
PYTHON_API_SHARED_SECRET=<shared-secret>
```

### Setup

```bash
# Install JS dependencies
cd iliterate && npm install

# Install Python dependencies (for CJK tokenization)
cd python-api && pip install -r requirements.txt

# Start Python NLP sidecar (terminal 1)
cd iliterate/python-api
uvicorn main:app --host 0.0.0.0 --port 8000

# Start Next.js dev server (terminal 2)
cd iliterate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:reader  # Reader component tests only
npx stryker run      # Run mutation testing
```

## Deployment

### Vercel (Next.js)
Set all environment variables in Vercel project settings. Root directory: `iliterate/`.

### Cloud Run (Python NLP sidecar)
```bash
cd iliterate/python-api
gcloud run deploy iliterate-nlp --source . --region us-central1 --allow-unauthenticated
```

Set `PYTHON_API_BASE_URL` in Vercel to the deployed Cloud Run URL.

## Security Notes
- Never commit live secrets. `.env.local` is gitignored.
- Keep production secrets in Vercel environment variables and Google Secret Manager.
- Rotate any credentials that were previously exposed before deploying.
