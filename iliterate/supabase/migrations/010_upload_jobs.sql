-- Create upload_jobs table for background processing of uploaded files
CREATE TABLE IF NOT EXISTS upload_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  upload_id uuid NULL,
  storage_path text NOT NULL,
  public_url text NULL,
  language text NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | processing | done | failed
  attempts int NOT NULL DEFAULT 0,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS upload_jobs_status_idx ON upload_jobs (status, attempts, created_at);
