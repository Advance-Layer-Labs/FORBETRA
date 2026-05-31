-- Flip Cycle.revealScores default from true → false (opt-in privacy posture).
-- Existing rows keep their current explicit value (no surprise to active cycles);
-- only NEW cycles created without an explicit revealScores will start opt-in.

-- AlterTable
ALTER TABLE "Cycle" ALTER COLUMN "revealScores" SET DEFAULT false;
