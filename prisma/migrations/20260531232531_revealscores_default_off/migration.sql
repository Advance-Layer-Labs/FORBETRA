-- Flip Cycle.revealScores default to false (opt-in privacy posture).
-- Product decision: reviewer feedback should be independent of self-scoring
-- to avoid anchoring bias and preserve the integrity of the perception gap.
-- Users can opt-in to Reveal at any time via /individual/settings.
-- Existing rows retain their explicit revealScores value (no surprise to
-- in-flight cycles).

-- AlterTable
ALTER TABLE "Cycle" ALTER COLUMN "revealScores" SET DEFAULT false;
