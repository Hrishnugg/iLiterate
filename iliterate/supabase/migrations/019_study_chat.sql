-- Persistent AI study chat sessions tied to extracted uploads

CREATE TABLE IF NOT EXISTS study_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New study chat',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES study_chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT study_chat_messages_role_check
        CHECK (role IN ('user', 'assistant')),
    CONSTRAINT study_chat_messages_body_length
        CHECK (char_length(body) BETWEEN 1 AND 12000)
);

CREATE TABLE IF NOT EXISTS study_chat_session_uploads (
    session_id UUID NOT NULL REFERENCES study_chat_sessions(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL REFERENCES user_uploads(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, upload_id)
);

CREATE INDEX IF NOT EXISTS idx_study_chat_sessions_user_updated
    ON study_chat_sessions (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_chat_messages_session_created
    ON study_chat_messages (session_id, created_at ASC);

ALTER TABLE study_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_chat_session_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own study chat sessions"
    ON study_chat_sessions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own study chat messages"
    ON study_chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM study_chat_sessions sessions
            WHERE sessions.id = session_id
              AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own study chat messages"
    ON study_chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM study_chat_sessions sessions
            WHERE sessions.id = session_id
              AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view own study chat uploads"
    ON study_chat_session_uploads FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM study_chat_sessions sessions
            WHERE sessions.id = session_id
              AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can attach own uploads to own study chats"
    ON study_chat_session_uploads FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM study_chat_sessions sessions
            WHERE sessions.id = session_id
              AND sessions.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1
            FROM user_uploads uploads
            WHERE uploads.id = upload_id
              AND uploads.user_id = auth.uid()
        )
    );
