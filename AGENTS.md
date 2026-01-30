# iLiterate - AI Coding Agent Guide

## Project Overview

iLiterate is a language learning platform that helps users read authentic content in new languages with instant translations, automatic flashcard generation, and adaptive learning. The application uses AI (Google Gemini) to provide translations, generate content, and process images for text extraction.

**Key Features:**
- Customized course content based on user background and learning goals
- Interactive reader with instant word/phrase translation
- Spaced repetition flashcard system (inspired by Anki)
- Knowledge check quizzes
- Real-world text examples (signs, menus, etc.)
- Image-to-text OCR for user uploads
- Words-per-minute (WPM) reader practice
- Learning streak tracking
- Row Level Security for user data protection

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16.1.6 (App Router) |
| **Runtime** | React 19.2.3 |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4 |
| **UI Components** | shadcn/ui (New York style) |
| **Icons** | Lucide React |
| **Database** | PostgreSQL via Supabase |
| **Auth** | Supabase Auth |
| **AI Services** | Google Gemini API |
| **Forms** | React Hook Form + Zod |
| **Notifications** | Sonner (toast notifications) |

## Project Structure

```
iliterate/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Route group: Authentication pages
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   └── onboarding/     # User profile setup after signup
│   │   ├── (dashboard)/        # Route group: Main app pages
│   │   │   ├── reader/         # Interactive content reader
│   │   │   ├── flashcards/     # Spaced repetition practice
│   │   │   ├── library/        # Content library
│   │   │   ├── quizzes/        # Knowledge checks
│   │   │   └── profile/        # User profile & settings
│   │   ├── layout.tsx          # Root layout (Geist font, metadata)
│   │   ├── page.tsx            # Landing page
│   │   └── globals.css         # Tailwind CSS + theme variables
│   ├── components/
│   │   └── ui/                 # shadcn/ui components (Button, Card, Dialog, etc.)
│   ├── lib/
│   │   ├── supabase/           # Supabase client utilities
│   │   │   ├── client.ts       # Browser client
│   │   │   ├── server.ts       # Server Component client
│   │   │   └── middleware.ts   # Session refresh middleware
│   │   └── utils.ts            # Utility functions (cn helper)
│   ├── types/
│   │   ├── database.ts         # Database entity TypeScript types
│   │   └── index.ts            # Additional app types
│   └── middleware.ts           # Next.js middleware (auth session handling)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Database schema with RLS policies
├── public/                     # Static assets
├── package.json
├── tsconfig.json
├── next.config.ts
├── components.json             # shadcn/ui configuration
├── postcss.config.mjs
├── eslint.config.mjs
└── .env.example                # Required environment variables
```

## Database Schema

The application uses PostgreSQL with the following main tables:

- **profiles**: User profiles extending Supabase auth (native/target language, education, proficiency)
- **streaks**: User learning streak tracking
- **content**: Reading materials with CEFR difficulty levels (A1-C2)
- **reading_progress**: User progress on content
- **vocabulary**: Dictionary of words with definitions
- **user_vocabulary**: User's saved words with spaced repetition data (SM-2 algorithm)
- **quiz_results**: Quiz attempt tracking
- **user_uploads**: OCR-processed image uploads

**Security**: Row Level Security (RLS) policies ensure users can only access their own data.

## Build and Development Commands

```bash
# Navigate to the project directory
cd iliterate

# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run ESLint
npm run lint
```

## Environment Setup

Create a `.env.local` file in the `iliterate/` directory with:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google AI (Required for translations & OCR)
GOOGLE_AI_API_KEY=your_gemini_api_key

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Code Style Guidelines

### TypeScript
- Strict mode enabled (`strict: true` in tsconfig.json)
- Use TypeScript types for all props and function parameters
- Path alias `@/*` maps to `./src/*`

### Component Patterns
- Use functional components with explicit return types
- shadcn/ui components are in `src/components/ui/`
- Custom components should follow React Server Components pattern where possible
- Client components should use `"use client"` directive at the top

### Styling
- Use Tailwind CSS utility classes
- Use the `cn()` utility from `@/lib/utils` for conditional class merging
- Color tokens use CSS variables (e.g., `bg-primary`, `text-muted-foreground`)
- Theme supports light/dark mode via `next-themes`

### Naming Conventions
- Components: PascalCase (e.g., `Button.tsx`, `ReaderPage.tsx`)
- Utilities: camelCase (e.g., `createClient.ts`)
- Route groups: parentheses (e.g., `(auth)`, `(dashboard)`)
- Database types: PascalCase interfaces (e.g., `Profile`, `UserVocabulary`)

## Key Dependencies

```json
{
  "@google/generative-ai": "^0.24.1",    // Gemini AI integration
  "@supabase/ssr": "^0.8.0",              // Server-side Supabase
  "@supabase/supabase-js": "^2.93.3",     // Supabase client
  "react-hook-form": "^7.71.1",           // Form handling
  "zod": "^4.3.6",                        // Schema validation
  "sonner": "^2.0.7",                     // Toast notifications
  "lucide-react": "^0.563.0",             // Icons
  "date-fns": "^4.1.0"                    // Date utilities
}
```

## Testing Strategy

Currently, the project does not have automated tests configured. Recommended additions:
- Unit tests with Vitest or Jest
- E2E tests with Playwright
- Component tests with React Testing Library

## Deployment

The application is designed for deployment on Vercel:

1. Connect repository to Vercel
2. Set environment variables in Vercel dashboard
3. Configure Supabase authentication redirect URLs
4. Deploy with `git push` or manual deployment

## Security Considerations

- All database tables have Row Level Security (RLS) enabled
- Authentication is handled by Supabase Auth
- Middleware refreshes sessions automatically
- Service role key should never be exposed to client-side code
- API keys should be stored in environment variables only

## Common Development Tasks

### Adding a New shadcn/ui Component
```bash
npx shadcn add <component-name>
```

### Creating a New Route
1. Create a new folder under `src/app/(dashboard)/` or `src/app/(auth)/`
2. Add `page.tsx` with the component
3. Optionally add `layout.tsx` for route-specific layout

### Adding Database Migrations
1. Create new SQL file in `supabase/migrations/`
2. Follow naming convention: `00N_description.sql`
3. Apply migrations via Supabase CLI or dashboard

## Group Members

- Ethan Fang (ewf22)
- Hrishi Hari (hxh644)
- Curtis Li (cxl1503)
- Anthony Retelewski (avr58)
