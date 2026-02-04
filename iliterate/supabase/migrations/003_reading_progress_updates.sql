-- Add missing columns to reading_progress table
ALTER TABLE reading_progress
ADD COLUMN IF NOT EXISTS progress_percentage DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS words_read INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create trigger for updated_at on reading_progress
CREATE TRIGGER update_reading_progress_updated_at
    BEFORE UPDATE ON reading_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
