-- Migration: Add speech formality preference to profiles
-- Description: Allows users to select their preferred formality level for generated content
-- Levels: casual, standard, professional, academic

-- Add speech_formality column with default value of 'standard'
ALTER TABLE profiles ADD COLUMN speech_formality TEXT DEFAULT 'standard';

-- Add constraint to ensure valid values
ALTER TABLE profiles ADD CONSTRAINT valid_speech_formality
    CHECK (speech_formality IN ('casual', 'standard', 'professional', 'academic'));
