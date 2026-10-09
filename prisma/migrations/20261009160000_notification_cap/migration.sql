-- CreateTable
CREATE TABLE "NotificationCap" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationCap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationCap_key_createdAt_idx" ON "NotificationCap"("key", "createdAt");
