ALTER TABLE "Email"
ADD COLUMN "triageStatus" TEXT NOT NULL DEFAULT 'INBOX',
ADD COLUMN "snoozedUntil" TIMESTAMP(3),
ADD COLUMN "handledAt" TIMESTAMP(3);
CREATE INDEX "Email_userId_triageStatus_snoozedUntil_idx" ON "Email"("userId", "triageStatus", "snoozedUntil");
