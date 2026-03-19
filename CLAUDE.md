# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

iLiterate is a language learning platform combining reading comprehension with spaced repetition flashcards. The main application is in the `iliterate/` directory.

## Development Commands

All commands run from `iliterate/` directory:

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run test         # Run tests (Vitest)
npm run test:watch   # Run tests in watch mode
npm run test:reader  # Run reader component tests only
```

The Python NLP sidecar (word difficulty + CJK tokenization) runs separately:
```bash
cd iliterate/python-api && uvicorn main:app --reload  # default port 8000
```

## Architecture

### Tech Stack
- **Frontend**: Next.js 16 (App Router, React Server Components), React 19, TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui components (Radix UI primitives)
- **Backend**: Supabase (PostgreSQL + Auth + Row Level Security)
- **AI Content Generation**: OpenAI `gpt-4o-mini` for lesson passages and quiz questions
- **AI Translation**: Google Gemini API for translations and OCR
- **TTS**: ElevenLabs API for reader audio and flashcard pronunciation
- **NLP Sidecar**: FastAPI Python service using wordfreq + Lindera for word difficulty and CJK tokenization
- **Testing**: Vitest with jsdom, React Testing Library
- **Forms**: React Hook Form + Zod validation

### Directory Structure
```
iliterate/src/
├── app/
│   ├── (auth)/           # Auth routes (login, signup, onboarding)
│   ├── (dashboard)/      # Protected routes (reader, flashcards, library, quizzes, profile, home, social)
│   └── api/              # Route handlers
├── components/
│   ├── ui/               # shadcn/ui primitives
│   ├── reader/           # Reader, AudioPlayer, ArticleRenderer
│   ├── flashcards/       # FlashcardCard, ReviewButtons, FlashcardReview, Deck
│   ├── home/             # Dashboard tiles (HeroTile, StreakTile, LevelTile, etc.)
│   └── leaderboard/      # LeaderboardTable, UserRankCard
├── lib/
│   ├── supabase/         # client.ts (browser), server.ts (SSR), middleware.ts
│   ├── tts/              # elevenlabs.ts (API wrapper), use-word-audio.ts (client cache hook)
│   ├── social/           # server.ts (admin client, friend helpers)
│   ├── points.ts         # Point award + streak refresh logic
│   ├── spaced-repetition.ts  # SM-2 algorithm
│   ├── lesson-generator.ts   # OpenAI lesson generation
│   ├── quiz-generator.ts     # OpenAI quiz generation
│   ├── level-system.ts       # XP thresholds, CEFR mapping
│   ├── python-api.ts         # Proxy to Python NLP sidecar
│   └── validations.ts        # Shared Zod schemas
└── types/                # Database models and spaced repetition types
```

### Key Patterns

**Supabase Client Usage** — three distinct clients:
- `createClient()` from `lib/supabase/client.ts` — browser-side, uses `NEXT_PUBLIC_` env vars
- `createClient()` from `lib/supabase/server.ts` — SSR, manages cookies for Server Components
- `createAdminClient()` from `lib/social/server.ts` — uses `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS; used for user lookups and social features

**API Route Auth Pattern** — all API routes follow this:
```typescript
const supabase = await createClient();  // from lib/supabase/server
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Middleware** (`lib/supabase/middleware.ts`) refreshes sessions on all requests. Protected routes (`/library`, `/reader`, `/flashcards`, `/quizzes`, `/profile`, `/home`, `/social`) redirect to `/login`. Auth routes (`/login`, `/signup`) redirect authenticated users to `/library`.

**SECURITY DEFINER SQL Functions** — leaderboard and streak functions bypass RLS to aggregate across users. These live in `supabase/migrations/` and are called via `supabase.rpc()`.

**Points & Gamification** — `point_events` is an immutable log. `awardPoints()` in `lib/points.ts` inserts events and automatically refreshes streaks + awards streak bonuses. Leaderboard SQL functions aggregate points by period (weekly/monthly).

**Spaced Repetition** — SM-2 algorithm in `lib/spaced-repetition.ts`. Card state stored in `user_vocabulary` (ease_factor, interval_days, repetitions, next_review_date). Response quality: again/hard/good/easy.

**Route Groups**: `(auth)` and `(dashboard)` have separate layouts. Dashboard has a collapsible sidebar.

**Component Variants**: class-variance-authority (CVA) for typed component styles.

## Environment Variables

Required in `.env.local`:
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# AI Services
GOOGLE_AI_API_KEY
OPENAI_API_KEY

# Text-to-Speech (ElevenLabs)
ELEVENLABS_API_KEY
ELEVENLABS_MODEL_ID              # optional, default: eleven_multilingual_v2
ELEVENLABS_VOICE_ID_DEFAULT      # fallback voice
# Per-language overrides: ELEVENLABS_VOICE_ID_EN, _ES, _FR, _DE, _JA, _KO, _ZH, etc.

# Python NLP Sidecar
PYTHON_API_BASE_URL              # default: http://localhost:8000
PYTHON_API_SHARED_SECRET         # optional in dev
```

## Database

Migrations are in `iliterate/supabase/migrations/`, numbered sequentially (001–015). Schema uses Row Level Security — users can only access their own data via `auth.uid() = user_id`. Cross-user queries (leaderboard, social) use `SECURITY DEFINER` functions.

Key tables: `profiles`, `public_profiles` (social identity + privacy), `streaks`, `content`, `vocabulary`, `user_vocabulary` (flashcard SM-2 state), `point_events`, `lesson_sessions`, `friendships`, `direct_messages`.
