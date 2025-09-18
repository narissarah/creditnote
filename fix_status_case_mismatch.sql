-- Fix status value case mismatch in credit_notes table
-- Update all existing uppercase status values to lowercase
-- This ensures consistency between database defaults and application code

-- Step 1: Update existing data to use lowercase status values
UPDATE credit_notes
SET status = CASE
    WHEN status = 'ACTIVE' THEN 'active'
    WHEN status = 'PARTIALLY_USED' THEN 'partially_used'
    WHEN status = 'FULLY_USED' THEN 'fully_used'
    WHEN status = 'DELETED' THEN 'deleted'
    WHEN status = 'EXPIRED' THEN 'expired'
    ELSE LOWER(status)
END
WHERE status != LOWER(status);

-- Step 2: Update the default value to use lowercase
ALTER TABLE credit_notes
ALTER COLUMN status SET DEFAULT 'active';

-- Step 3: Verify the changes
SELECT DISTINCT status, COUNT(*) as count
FROM credit_notes
GROUP BY status
ORDER BY status;