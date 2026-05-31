-- Restore Cycle.revealScores default to true after a brief in-development flip.
-- Per product decision: reveal is the default posture (stakeholders see self-scores
-- by default); individuals opt out via /individual/settings if they want privacy.

-- AlterTable
ALTER TABLE "Cycle" ALTER COLUMN "revealScores" SET DEFAULT true;
