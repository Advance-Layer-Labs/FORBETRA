-- Add weekly-insight uniqueness constraint to prevent TOCTOU duplicate generation
-- (one weekly Insight per user/cycle/week/type). NULLs are treated as distinct in
-- Postgres, so this only enforces uniqueness for rows where cycleId + weekNumber
-- are both non-NULL — i.e. WEEKLY insights. COACH_PREP / CYCLE_REPORT insights
-- with NULL weekNumber are unaffected.

-- CreateIndex
CREATE UNIQUE INDEX "Insight_userId_cycleId_weekNumber_type_key" ON "Insight"("userId", "cycleId", "weekNumber", "type");
