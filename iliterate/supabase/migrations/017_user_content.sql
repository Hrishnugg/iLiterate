-- Add user_id to content table for user-uploaded content
-- NULL = public/shared content, set = user-uploaded
ALTER TABLE content ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Users can insert their own content
CREATE POLICY "Users can insert own content" ON content
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own uploaded content
CREATE POLICY "Users can delete own content" ON content
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- Update the existing view policy to allow users to see public content OR their own
DROP POLICY IF EXISTS "Authenticated users can view content" ON content;
CREATE POLICY "Authenticated users can view content" ON content
    FOR SELECT TO authenticated
    USING (user_id IS NULL OR auth.uid() = user_id);
