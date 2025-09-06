-- Add new fields to credit_notes table
ALTER TABLE "credit_notes" 
ADD COLUMN IF NOT EXISTS "shop" TEXT,
ADD COLUMN IF NOT EXISTS "noteNumber" TEXT,
ADD COLUMN IF NOT EXISTS "customerEmail" TEXT,
ADD COLUMN IF NOT EXISTS "qrCodeImage" TEXT,
ADD COLUMN IF NOT EXISTS "qrCodeData" JSONB,
ADD COLUMN IF NOT EXISTS "reason" TEXT,
ADD COLUMN IF NOT EXISTS "originalOrderId" TEXT,
ADD COLUMN IF NOT EXISTS "originalOrderNumber" TEXT;

-- Update existing records to have shop field from shopDomain
UPDATE "credit_notes" 
SET "shop" = "shopDomain" 
WHERE "shop" IS NULL AND "shopDomain" IS NOT NULL;

-- Generate temporary noteNumbers for existing records
UPDATE "credit_notes"
SET "noteNumber" = CONCAT('CN-2024-TEMP-', "id")
WHERE "noteNumber" IS NULL;