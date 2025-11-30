-- Migration: Add username field to users table
-- Run this to add username tracking for better usage analytics

-- Add username column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);

-- Add index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Update existing users to have a default username based on their tier
UPDATE users 
SET username = CONCAT(tier, '_user_', SUBSTRING(user_key FROM 1 FOR 8))
WHERE username IS NULL;

COMMENT ON COLUMN users.username IS 'Optional display name for identifying users in logs';
