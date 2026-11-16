-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResearchRunStatus" AS ENUM ('PENDING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN     "factId" TEXT;

-- AlterTable
ALTER TABLE "Signal" ADD COLUMN     "status" "SignalStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "rawContent" TEXT;

-- CreateTable
CREATE TABLE "Fact" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "confidence" INTEGER,
    "context" TEXT,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchRun" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "status" "ResearchRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "sourcesFound" INTEGER NOT NULL DEFAULT 0,
    "factsExtracted" INTEGER NOT NULL DEFAULT 0,
    "signalsDetected" INTEGER NOT NULL DEFAULT 0,
    "newSignalIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scoreBefore" INTEGER,
    "scoreAfter" INTEGER,
    "researchInsightId" TEXT,
    "whyNowInsightId" TEXT,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fact_accountId_idx" ON "Fact"("accountId");

-- CreateIndex
CREATE INDEX "Fact_sourceId_idx" ON "Fact"("sourceId");

-- CreateIndex
CREATE INDEX "ResearchRun_accountId_idx" ON "ResearchRun"("accountId");

-- CreateIndex
CREATE INDEX "Evidence_factId_idx" ON "Evidence"("factId");

-- CreateIndex
CREATE INDEX "Signal_status_idx" ON "Signal"("status");

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_factId_fkey" FOREIGN KEY ("factId") REFERENCES "Fact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchRun" ADD CONSTRAINT "ResearchRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
