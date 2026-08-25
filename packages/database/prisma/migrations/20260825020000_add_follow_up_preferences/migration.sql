CREATE TABLE "FollowUpPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "signalKey" TEXT NOT NULL,
  "snoozedUntil" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FollowUpPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FollowUpPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FollowUpPreference_userId_signalKey_key" ON "FollowUpPreference"("userId", "signalKey");
CREATE INDEX "FollowUpPreference_userId_snoozedUntil_idx" ON "FollowUpPreference"("userId", "snoozedUntil");
