CREATE TABLE "Sprint" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "goal" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "wipLimit" INTEGER NOT NULL DEFAULT 3,
  "review" TEXT,
  "retrospective" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Sprint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "Task" ADD COLUMN "sprintId" TEXT, ADD COLUMN "estimate" INTEGER, ADD COLUMN "assignee" TEXT, ADD COLUMN "project" TEXT, ADD COLUMN "blockedReason" TEXT;
ALTER TABLE "Task" ADD CONSTRAINT "Task_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Sprint_userId_status_startAt_idx" ON "Sprint"("userId", "status", "startAt");
CREATE INDEX "Task_sprintId_status_idx" ON "Task"("sprintId", "status");
