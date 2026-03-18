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
OPENAI_API_KEY=<your-openai-api-key>
ELEVENLABS_API_KEY=<your-elevenlabs-api-key>
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
NEXT_PUBLIC_APP_URL=http://localhost:3000
PYTHON_API_BASE_URL=http://localhost:8000
PYTHON_API_SHARED_SECRET=<shared-secret-for-next-and-python-api>
```

`PYTHON_API_SHARED_SECRET` can be omitted for quick local development, but production should set it in both Vercel and Cloud Run.

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
export PYTHON_API_SHARED_SECRET=<shared-secret-for-next-and-python-api>
uvicorn main:app --host 0.0.0.0 --port 8000
```

This runs the FastAPI NLP sidecar on port 8000. It provides:
- `GET /healthz`
- `POST /tokenize`
- `POST /word-difficulty`

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
npm test         # Run Vitest
```

## Production Deployment

### Vercel

- Create a single Vercel project with the root directory set to `iliterate/`.
- Configure these environment variables in Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GOOGLE_AI_API_KEY`
  - `OPENAI_API_KEY`
  - `ELEVENLABS_API_KEY`
  - `ELEVENLABS_MODEL_ID`
  - `ELEVENLABS_VOICE_ID_*` as needed
  - `NEXT_PUBLIC_APP_URL`
  - `PYTHON_API_BASE_URL`
  - `PYTHON_API_SHARED_SECRET`
- Update Supabase Auth redirect URLs to the production Vercel domain before launch.

### Cloud Run

The Python sidecar is containerized in `python-api/Dockerfile`.

Example deployment flow:

```bash
cd iliterate/python-api
gcloud run deploy iliterate-nlp \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --cpu 1 \
  --memory 512Mi \
  --timeout 30 \
  --min-instances 0 \
  --set-secrets PYTHON_API_SHARED_SECRET=python-api-shared-secret:latest
```

Set `PYTHON_API_BASE_URL` in Vercel to the deployed Cloud Run HTTPS URL.

## Security Notes

- Do not commit live secrets. `env.yaml` is now a sanitized template only.
- Rotate any credentials that were previously stored in tracked files before deploying.
- Keep production secrets in Vercel environment variables and Google Secret Manager.
