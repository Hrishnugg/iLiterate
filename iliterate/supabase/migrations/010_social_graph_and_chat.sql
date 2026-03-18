-- Migration: 010_social_graph_and_chat.sql
-- Description: Add public social profiles, friendships, and direct messaging

-- ============================================================================
-- 1. Public Social Profiles
-- ============================================================================
CREATE TABLE public_profiles (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    username TEXT,
    display_name TEXT NOT NULL,
    avatar_seed TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT public_profiles_username_format
        CHECK (
            username IS NULL OR username ~ '^[a-z0-9_]{3,24}$'
        ),
    CONSTRAINT public_profiles_display_name_length
        CHECK (
            char_length(trim(display_name)) BETWEEN 1 AND 50
        )
);

CREATE UNIQUE INDEX idx_public_profiles_username_unique
    ON public_profiles (lower(username))
    WHERE username IS NOT NULL;

CREATE INDEX idx_public_profiles_display_name
    ON public_profiles (lower(display_name));

INSERT INTO public_profiles (id, display_name, avatar_seed)
SELECT
    p.id,
    COALESCE(
        NULLIF(trim(au.raw_user_meta_data ->> 'full_name'), ''),
        NULLIF(split_part(au.email, '@', 1), ''),
        'Learner'
    ) AS display_name,
    substr(p.id::text, 1, 8) AS avatar_seed
FROM profiles p
LEFT JOIN auth.users au
    ON au.id = p.id
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Friendships
-- ============================================================================
CREATE TABLE friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_one_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    user_two_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT friendships_distinct_users CHECK (user_one_id <> user_two_id),
    CONSTRAINT friendships_normalized_pair CHECK (user_one_id < user_two_id),
    CONSTRAINT friendships_participants_match
        CHECK (
            requester_id <> recipient_id
            AND requester_id IN (user_one_id, user_two_id)
            AND recipient_id IN (user_one_id, user_two_id)
        ),
    CONSTRAINT friendships_unique_pair UNIQUE (user_one_id, user_two_id)
);

CREATE INDEX idx_friendships_requester_status
    ON friendships (requester_id, status, created_at DESC);

CREATE INDEX idx_friendships_recipient_status
    ON friendships (recipient_id, status, created_at DESC);

-- ============================================================================
-- 3. Direct Conversations
-- ============================================================================
CREATE TABLE direct_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_one_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    user_two_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT direct_conversations_distinct_users CHECK (user_one_id <> user_two_id),
    CONSTRAINT direct_conversations_normalized_pair CHECK (user_one_id < user_two_id),
    CONSTRAINT direct_conversations_unique_pair UNIQUE (user_one_id, user_two_id)
);

CREATE INDEX idx_direct_conversations_last_message
    ON direct_conversations (last_message_at DESC NULLS LAST, created_at DESC);

-- ============================================================================
-- 4. Conversation Read State
-- ============================================================================
CREATE TABLE conversation_reads (
    conversation_id UUID NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_conversation_reads_user
    ON conversation_reads (user_id, updated_at DESC);

-- ============================================================================
-- 5. Direct Messages
-- ============================================================================
CREATE TABLE direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT direct_messages_body_length
        CHECK (char_length(trim(body)) BETWEEN 1 AND 2000)
);

CREATE INDEX idx_direct_messages_conversation
    ON direct_messages (conversation_id, created_at DESC);

CREATE INDEX idx_direct_messages_sender
    ON direct_messages (sender_id, created_at DESC);

-- ============================================================================
-- 6. Helper Functions and Triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION are_social_friends(p_user_one UUID, p_user_two UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM friendships
        WHERE status = 'accepted'
          AND (
            (user_one_id = p_user_one AND user_two_id = p_user_two)
            OR
            (user_one_id = p_user_two AND user_two_id = p_user_one)
          )
    );
$$;

CREATE OR REPLACE FUNCTION can_access_conversation(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM direct_conversations dc
        WHERE dc.id = p_conversation_id
          AND p_user_id IN (dc.user_one_id, dc.user_two_id)
          AND are_social_friends(dc.user_one_id, dc.user_two_id)
    );
$$;

CREATE OR REPLACE FUNCTION sync_direct_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE direct_conversations
    SET
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.body, 120),
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

CREATE TRIGGER trg_sync_direct_conversation_on_message
AFTER INSERT ON direct_messages
FOR EACH ROW
EXECUTE FUNCTION sync_direct_conversation_on_message();

-- ============================================================================
-- 7. Row Level Security
-- ============================================================================
ALTER TABLE public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view public profiles"
    ON public_profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert own public profile"
    ON public_profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own public profile"
    ON public_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view related friendships"
    ON friendships FOR SELECT
    TO authenticated
    USING (auth.uid() IN (requester_id, recipient_id));

CREATE POLICY "Users can create outgoing friendships"
    ON friendships FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = requester_id
        AND auth.uid() <> recipient_id
        AND auth.uid() IN (user_one_id, user_two_id)
        AND recipient_id IN (user_one_id, user_two_id)
    );

CREATE POLICY "Users can update related friendships"
    ON friendships FOR UPDATE
    TO authenticated
    USING (auth.uid() IN (requester_id, recipient_id))
    WITH CHECK (auth.uid() IN (requester_id, recipient_id));

CREATE POLICY "Users can delete related friendships"
    ON friendships FOR DELETE
    TO authenticated
    USING (auth.uid() IN (requester_id, recipient_id));

CREATE POLICY "Users can view own direct conversations"
    ON direct_conversations FOR SELECT
    TO authenticated
    USING (
        auth.uid() IN (user_one_id, user_two_id)
        AND are_social_friends(user_one_id, user_two_id)
    );

CREATE POLICY "Users can create direct conversations with accepted friends"
    ON direct_conversations FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() IN (user_one_id, user_two_id)
        AND are_social_friends(user_one_id, user_two_id)
    );

CREATE POLICY "Users can update own direct conversations"
    ON direct_conversations FOR UPDATE
    TO authenticated
    USING (
        auth.uid() IN (user_one_id, user_two_id)
        AND are_social_friends(user_one_id, user_two_id)
    )
    WITH CHECK (
        auth.uid() IN (user_one_id, user_two_id)
        AND are_social_friends(user_one_id, user_two_id)
    );

CREATE POLICY "Users can view own read states"
    ON conversation_reads FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        AND can_access_conversation(conversation_id, auth.uid())
    );

CREATE POLICY "Users can insert own read states"
    ON conversation_reads FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
        AND can_access_conversation(conversation_id, auth.uid())
    );

CREATE POLICY "Users can update own read states"
    ON conversation_reads FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = user_id
        AND can_access_conversation(conversation_id, auth.uid())
    )
    WITH CHECK (
        auth.uid() = user_id
        AND can_access_conversation(conversation_id, auth.uid())
    );

CREATE POLICY "Users can view messages in accessible conversations"
    ON direct_messages FOR SELECT
    TO authenticated
    USING (can_access_conversation(conversation_id, auth.uid()));

CREATE POLICY "Users can insert messages in accessible conversations"
    ON direct_messages FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = sender_id
        AND can_access_conversation(conversation_id, auth.uid())
    );

-- ============================================================================
-- 8. Realtime Publication
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'direct_conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE direct_conversations;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'conversation_reads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE conversation_reads;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'direct_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
    END IF;
END;
$$;
