-- CreateEnum
CREATE TYPE "InsightStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('FACT', 'INFERENCE', 'RECOMMENDATION');

-- AlterTable
ALTER TABLE "AccountInsight" ADD COLUMN     "error" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'anthropic',
ADD COLUMN     "status" "InsightStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "content" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN     "claimType" "ClaimType" NOT NULL DEFAULT 'FACT';

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publisher" TEXT;
