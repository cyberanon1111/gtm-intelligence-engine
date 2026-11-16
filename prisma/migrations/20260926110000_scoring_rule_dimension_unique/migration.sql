-- DropIndex
DROP INDEX "ScoringRule_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "ScoringRule_dimension_key" ON "ScoringRule"("dimension");
