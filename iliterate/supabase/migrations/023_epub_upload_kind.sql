-- Add 'epub' as a valid upload kind

ALTER TABLE user_uploads
    DROP CONSTRAINT IF EXISTS user_uploads_kind_check;

ALTER TABLE user_uploads
    ADD CONSTRAINT user_uploads_kind_check
    CHECK (kind IN ('image', 'pdf', 'docx', 'epub', 'unknown'));
