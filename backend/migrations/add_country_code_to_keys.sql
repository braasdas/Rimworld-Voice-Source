-- Migration: Add country_code column to elevenlabs_keys table
-- This allows each ElevenLabs key to specify which country's residential proxy to use

-- Add country_code column (2-letter ISO country code, e.g., 'us', 'gb', 'de')
ALTER TABLE elevenlabs_keys
ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) DEFAULT 'us';

-- Add comment for documentation
COMMENT ON COLUMN elevenlabs_keys.country_code IS 'ISO 3166-1 alpha-2 country code for Oxylabs residential proxy (e.g., us, gb, de, fr, ca)';

-- Update existing keys to use 'us' as default (if not already set)
UPDATE elevenlabs_keys
SET country_code = 'us'
WHERE country_code IS NULL;
