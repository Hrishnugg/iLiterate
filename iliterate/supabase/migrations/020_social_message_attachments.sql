-- Rich direct messages with typed attachments and previews

ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS message_kind TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS primary_attachment_type TEXT,
  ADD COLUMN IF NOT EXISTS attachment_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE direct_messages
  ALTER COLUMN body SET DEFAULT '';

UPDATE direct_messages
SET body = COALESCE(body, '')
WHERE body IS NULL;

ALTER TABLE direct_messages
  ALTER COLUMN body SET NOT NULL;

ALTER TABLE direct_messages
  DROP CONSTRAINT IF EXISTS direct_messages_body_length;

ALTER TABLE direct_messages
  ADD CONSTRAINT direct_messages_body_length
    CHECK (char_length(trim(body)) <= 2000),
  ADD CONSTRAINT direct_messages_message_kind
    CHECK (message_kind IN ('text', 'attachment', 'mixed')),
  ADD CONSTRAINT direct_messages_primary_attachment_type
    CHECK (
      primary_attachment_type IS NULL
      OR primary_attachment_type IN ('image', 'pdf', 'docx')
    ),
  ADD CONSTRAINT direct_messages_attachment_count_nonnegative
    CHECK (attachment_count >= 0);

CREATE TABLE IF NOT EXISTS direct_message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  upload_id UUID NOT NULL REFERENCES user_uploads(id) ON DELETE CASCADE,
  attachment_type TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  extracted_text TEXT,
  detected_language TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT direct_message_attachments_type
    CHECK (attachment_type IN ('image', 'pdf', 'docx')),
  CONSTRAINT direct_message_attachments_unique_upload
    UNIQUE (message_id, upload_id)
);

CREATE INDEX IF NOT EXISTS idx_direct_message_attachments_message
  ON direct_message_attachments (message_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_direct_message_attachments_upload
  ON direct_message_attachments (upload_id);

CREATE OR REPLACE FUNCTION sync_direct_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  preview_text TEXT;
BEGIN
  preview_text := CASE
    WHEN NEW.message_kind = 'attachment' THEN
      CASE NEW.primary_attachment_type
        WHEN 'image' THEN 'Sent an image'
        WHEN 'pdf' THEN 'Sent a PDF'
        WHEN 'docx' THEN 'Sent a document'
        ELSE 'Sent an attachment'
      END
    ELSE COALESCE(NULLIF(LEFT(trim(NEW.body), 120), ''), 'Sent a message')
  END;

  UPDATE direct_conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = preview_text,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  INSERT INTO conversation_reads (
    conversation_id,
    user_id,
    last_read_at,
    created_at,
    updated_at
  )
  VALUES (
    NEW.conversation_id,
    NEW.sender_id,
    NEW.created_at,
    NOW(),
    NOW()
  )
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    last_read_at = EXCLUDED.last_read_at,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

ALTER TABLE direct_message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments in accessible conversations"
  ON direct_message_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM direct_messages dm
      WHERE dm.id = message_id
        AND can_access_conversation(dm.conversation_id, auth.uid())
    )
  );

CREATE POLICY "Users can insert attachments for own messages"
  ON direct_message_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM direct_messages dm
      WHERE dm.id = message_id
        AND dm.sender_id = auth.uid()
        AND can_access_conversation(dm.conversation_id, auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM user_uploads uu
      WHERE uu.id = upload_id
        AND uu.user_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'direct_message_attachments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE direct_message_attachments;
  END IF;
END;
$$;
