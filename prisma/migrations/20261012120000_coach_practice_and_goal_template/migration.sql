-- AlterTable
ALTER TABLE "User" ADD COLUMN "coachingFocus" TEXT,
ADD COLUMN "practiceName" TEXT,
ADD COLUMN "practiceDescription" TEXT;

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN "sourceTemplateId" TEXT;
