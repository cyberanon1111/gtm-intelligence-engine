-- CreateEnum
CREATE TYPE "ActivationChannel" AS ENUM ('LINKEDIN', 'EMAIL', 'SALES_BRIEF', 'CONTENT_RECOMMENDATION');

-- CreateEnum
CREATE TYPE "ActivationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SENT', 'CANCELLED');

-- CreateTable
CREATE TABLE "Activation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "contactId" TEXT,
    "channel" "ActivationChannel" NOT NULL,
    "status" "ActivationStatus" NOT NULL DEFAULT 'DRAFT',
    "objective" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "reasoning" TEXT NOT NULL,
    "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceInsightId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "regeneratedFromId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activation_accountId_idx" ON "Activation"("accountId");

-- CreateIndex
CREATE INDEX "Activation_contactId_idx" ON "Activation"("contactId");

-- CreateIndex
CREATE INDEX "Activation_status_idx" ON "Activation"("status");

-- CreateIndex
CREATE INDEX "Activation_channel_idx" ON "Activation"("channel");

-- AddForeignKey
ALTER TABLE "Activation" ADD CONSTRAINT "Activation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activation" ADD CONSTRAINT "Activation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
