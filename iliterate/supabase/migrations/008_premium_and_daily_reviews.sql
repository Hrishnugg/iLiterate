-- Migration: Add premium status and daily review tracking for flashcards

-- Add premium and review tracking columns to profiles
ALTER TABLE profiles ADD COLUMN is_premium BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN daily_reviews_used INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN last_review_date DATE;

-- Create index for efficient premium user queries
CREATE INDEX idx_profiles_is_premium ON profiles(is_premium) WHERE is_premium = true;
