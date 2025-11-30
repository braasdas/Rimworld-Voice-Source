-- Fix foreign key constraint to allow deleting ElevenLabs keys
-- This will set elevenlabs_key_id to NULL in usage_logs when a key is deleted

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE usage_logs 
DROP CONSTRAINT IF EXISTS usage_logs_elevenlabs_key_id_fkey;

-- Step 2: Re-add the constraint with ON DELETE SET NULL
ALTER TABLE usage_logs 
ADD CONSTRAINT usage_logs_elevenlabs_key_id_fkey 
FOREIGN KEY (elevenlabs_key_id) 
REFERENCES elevenlabs_keys(id) 
ON DELETE SET NULL;

-- Verify the constraint was added
SELECT conname, conrelid::regclass, confrelid::regclass, confupdtype, confdeltype
FROM pg_constraint 
WHERE conname = 'usage_logs_elevenlabs_key_id_fkey';
