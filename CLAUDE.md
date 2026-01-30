# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

iLiterate is a language learning platform combining reading comprehension with spaced repetition flashcards. The main application is in the `iliterate/` directory.

## Development Commands

All commands run from `iliterate/` directory:

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

## Architecture

### Tech Stack
- **Frontend**: Next.js 16 (App Router, React Server Components), React 19, TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui components (Radix UI primitives)
- **Backend**: Supabase (PostgreSQL + Auth + Row Level Security)
- **AI**: Google Gemini API for translations, OCR, content generation
- **Forms**: React Hook Form + Zod validation

### Directory Structure
```
iliterate/src/
├── app/
│   ├── (auth)/       # Auth routes (login, signup, onboarding)
│   └── (dashboard)/  # Protected routes (reader, flashcards, library, quizzes, profile)
├── components/ui/    # shadcn/ui components
├── lib/
│   ├── supabase/     # client.ts (browser), server.ts (SSR), middleware.ts
│   └── utils.ts      # cn() helper for className merging
└── types/            # Database models and spaced repetition types
```

### Database Models
Core tables with RLS policies: Profile, Streak, Content, ReadingProgress, Vocabulary, UserVocabulary (flashcards with SM-2 algorithm fields), QuizResult, UserUpload

### Key Patterns
- **Route Groups**: `(auth)` and `(dashboard)` separate layouts
- **Spaced Repetition**: SM-2 algorithm stored in `user_vocabulary` (ease_factor, interval_days, repetitions, next_review_date)
- **Auth Flow**: Supabase Auth with middleware session refresh on all routes
- **Component Variants**: class-variance-authority (CVA) for typed component styles

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_AI_API_KEY
```

## Database

Migrations are in `iliterate/supabase/migrations/`. Schema uses Row Level Security (RLS) - users can only access their own data via user_id filtering.
