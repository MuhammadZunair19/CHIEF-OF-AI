CREATE TABLE "GmailWatch" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "historyId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastNotificationAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GmailWatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GmailWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GmailWatch_userId_key" ON "GmailWatch"("userId");
CREATE INDEX "GmailWatch_expiresAt_idx" ON "GmailWatch"("expiresAt");
