# iLiterate

A language learning platform combining reading comprehension with spaced repetition flashcards.

## Prerequisites

- Node.js 18+
- Python 3.10+
- A Supabase project with the migrations applied (see `supabase/migrations/`)

## Environment Variables

Create a `.env.local` file in the `iliterate/` directory:

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
GOOGLE_AI_API_KEY=<your-google-ai-api-key>
```

## Getting Started

### 1. Install dependencies

```bash
cd iliterate
npm install
```

### 2. Install Python dependencies (required for CJK tokenization)

The RSVP speed reader requires a Python tokenization service for Chinese, Japanese, and Korean text segmentation.

```bash
cd iliterate/python-api
pip install -r requirements.txt
```

### 3. Start the tokenization service

```bash
cd iliterate/python-api
uvicorn main:app --host 0.0.0.0 --port 8000
```

This runs the FastAPI tokenization service on port 8000.

### 4. Start the Next.js development server

In a separate terminal:

```bash
cd iliterate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development Commands

All commands run from the `iliterate/` directory:

```bash
npm run dev      # Start Next.js development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```
