-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credit_notes" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" VARCHAR(255),
    "originalAmount" DECIMAL(10,2) NOT NULL,
    "remainingAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "status" TEXT NOT NULL DEFAULT 'active',
    "qrCode" TEXT,
    "shopDomain" TEXT NOT NULL,
    "orderId" TEXT,
    "metafieldId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "shop" TEXT,
    "noteNumber" TEXT,
    "customerEmail" TEXT,
    "qrCodeImage" TEXT,
    "qrCodeData" JSONB,
    "reason" TEXT,
    "originalOrderId" TEXT,
    "originalOrderNumber" TEXT,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credit_redemptions" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "posTerminal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."shop_settings" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "creditPrefix" TEXT NOT NULL DEFAULT 'CN-',
    "autoExpireDays" INTEGER DEFAULT 365,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_noteNumber_key" ON "public"."credit_notes"("noteNumber");

-- CreateIndex
CREATE INDEX "credit_notes_customerId_idx" ON "public"."credit_notes"("customerId");

-- CreateIndex
CREATE INDEX "credit_notes_shopDomain_status_idx" ON "public"."credit_notes"("shopDomain", "status");

-- CreateIndex
CREATE INDEX "credit_notes_metafieldId_idx" ON "public"."credit_notes"("metafieldId");

-- CreateIndex
CREATE INDEX "credit_notes_orderId_idx" ON "public"."credit_notes"("orderId");

-- CreateIndex
CREATE INDEX "credit_redemptions_creditNoteId_idx" ON "public"."credit_redemptions"("creditNoteId");

-- CreateIndex
CREATE INDEX "credit_redemptions_orderId_idx" ON "public"."credit_redemptions"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "shop_settings_shopDomain_key" ON "public"."shop_settings"("shopDomain");

-- AddForeignKey
ALTER TABLE "public"."credit_redemptions" ADD CONSTRAINT "credit_redemptions_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "public"."credit_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

