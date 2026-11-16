-- CreateEnum
CREATE TYPE "SourceQuality" AS ENUM ('OFFICIAL_PRIMARY', 'INDUSTRY_PUBLICATION', 'SECONDARY', 'UNKNOWN');

-- AlterEnum
ALTER TYPE "ResearchRunStatus" ADD VALUE 'SKIPPED';

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "quality" "SourceQuality" NOT NULL DEFAULT 'UNKNOWN';
