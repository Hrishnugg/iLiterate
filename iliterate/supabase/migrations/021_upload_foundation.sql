-- Shared upload foundation for library imports, study chat, and DM attachments

ALTER TABLE user_uploads
    ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'content_import',
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS original_filename TEXT,
    ADD COLUMN IF NOT EXISTS mime_type TEXT,
    ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'uploaded',
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE user_uploads
    DROP CONSTRAINT IF EXISTS user_uploads_kind_check;

ALTER TABLE user_uploads
    ADD CONSTRAINT user_uploads_kind_check
    CHECK (kind IN ('image', 'pdf', 'docx', 'unknown'));

ALTER TABLE user_uploads
    DROP CONSTRAINT IF EXISTS user_uploads_scope_check;

ALTER TABLE user_uploads
    ADD CONSTRAINT user_uploads_scope_check
    CHECK (scope IN ('content_import', 'study_chat', 'dm_attachment'));

ALTER TABLE user_uploads
    DROP CONSTRAINT IF EXISTS user_uploads_status_check;

ALTER TABLE user_uploads
    ADD CONSTRAINT user_uploads_status_check
    CHECK (status IN ('uploaded', 'processed', 'failed'));

ALTER TABLE content
    ADD COLUMN IF NOT EXISTS source_upload_id UUID REFERENCES user_uploads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_uploads_user_scope_created
    ON user_uploads (user_id, scope, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_source_upload_id
    ON content (source_upload_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('user-uploads', 'user-uploads', false)
ON CONFLICT (id) DO NOTHING;
