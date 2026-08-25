CREATE TABLE "ContactMemory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT,
  "notes" TEXT,
  "commonTopics" TEXT[],
  "interactionCount" INTEGER NOT NULL DEFAULT 0,
  "lastInteractionAt" TIMESTAMP(3) NOT NULL,
  "preferredMeetingMinutes" INTEGER,
  "typicalResponseHours" DOUBLE PRECISION,
  "importantDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactMemory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContactMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ContactMemory_userId_email_key" ON "ContactMemory"("userId", "email");
CREATE INDEX "ContactMemory_userId_lastInteractionAt_idx" ON "ContactMemory"("userId", "lastInteractionAt" DESC);
