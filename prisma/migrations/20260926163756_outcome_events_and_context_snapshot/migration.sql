-- CreateEnum
CREATE TYPE "OutcomeEventType" AS ENUM ('DELIVERED', 'OPENED', 'CLICKED', 'REPLIED', 'POSITIVE_REPLY', 'NEGATIVE_REPLY', 'MEETING_BOOKED', 'MEETING_HELD', 'OPPORTUNITY_CREATED', 'OPPORTUNITY_WON', 'OPPORTUNITY_LOST', 'NO_RESPONSE', 'UNSUBSCRIBED');

-- AlterTable
ALTER TABLE "Activation" ADD COLUMN     "angle" TEXT,
ADD COLUMN     "contextSnapshot" JSONB,
ADD COLUMN     "cta" TEXT;

-- CreateTable
CREATE TABLE "OutcomeEvent" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "contactId" TEXT,
    "activationId" TEXT,
    "type" "OutcomeEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutcomeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutcomeEvent_accountId_idx" ON "OutcomeEvent"("accountId");

-- CreateIndex
CREATE INDEX "OutcomeEvent_contactId_idx" ON "OutcomeEvent"("contactId");

-- CreateIndex
CREATE INDEX "OutcomeEvent_activationId_idx" ON "OutcomeEvent"("activationId");

-- CreateIndex
CREATE INDEX "OutcomeEvent_type_idx" ON "OutcomeEvent"("type");

-- CreateIndex
CREATE INDEX "OutcomeEvent_occurredAt_idx" ON "OutcomeEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "Activation_angle_idx" ON "Activation"("angle");

-- AddForeignKey
ALTER TABLE "OutcomeEvent" ADD CONSTRAINT "OutcomeEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeEvent" ADD CONSTRAINT "OutcomeEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeEvent" ADD CONSTRAINT "OutcomeEvent_activationId_fkey" FOREIGN KEY ("activationId") REFERENCES "Activation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
