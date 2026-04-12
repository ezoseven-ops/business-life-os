-- AlterEnum: TaskStatus — add BLOCKED value
ALTER TYPE "TaskStatus" ADD VALUE 'BLOCKED';

-- AlterTable: Project — add deadline
ALTER TABLE "Project" ADD COLUMN "deadline" TIMESTAMP(3);

-- AlterTable: Note — add hasActionItems
ALTER TABLE "Note" ADD COLUMN "hasActionItems" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Message — add follow-up and response tracking fields
ALTER TABLE "Message" ADD COLUMN "readAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "followUpRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN "followUpCompletedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "awaitingResponse" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN "respondedAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "DayRecordType" AS ENUM ('OPEN_DAY', 'CLOSE_DAY');

-- CreateTable
CREATE TABLE "DayRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "DayRecordType" NOT NULL,
    "data" JSONB NOT NULL,
    "aiSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DayRecord_userId_date_type_key" ON "DayRecord"("userId", "date", "type");

-- CreateIndex
CREATE INDEX "DayRecord_userId_date_idx" ON "DayRecord"("userId", "date");

-- AddForeignKey
ALTER TABLE "DayRecord" ADD CONSTRAINT "DayRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Task — add completedAt
ALTER TABLE "Task" ADD COLUMN "completedAt" TIMESTAMP(3);

-- AlterTable: Message — add projectId
ALTER TABLE "Message" ADD COLUMN "projectId" TEXT;

-- CreateIndex
CREATE INDEX "Message_projectId_idx" ON "Message"("projectId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "DayRitualConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredOpenTime" TEXT,
    "preferredCloseTime" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Warsaw',
    "overdueEscalationDays" INTEGER NOT NULL DEFAULT 5,
    "blockedEscalationDays" INTEGER NOT NULL DEFAULT 3,
    "followUpStaleDays" INTEGER NOT NULL DEFAULT 3,
    "deadlineWarningDays" INTEGER NOT NULL DEFAULT 7,
    "stalledProjectDays" INTEGER NOT NULL DEFAULT 7,
    "criticalOverdueDays" INTEGER NOT NULL DEFAULT 3,
    "lowCompletionRateThreshold" INTEGER NOT NULL DEFAULT 30,
    "priorityWeights" JSONB,
    "aiLanguage" TEXT NOT NULL DEFAULT 'pl',
    "aiSummaryGuidance" TEXT NOT NULL DEFAULT '3-5 sentences, concise, action-oriented',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayRitualConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DayRitualConfig_userId_key" ON "DayRitualConfig"("userId");

-- AddForeignKey
ALTER TABLE "DayRitualConfig" ADD CONSTRAINT "DayRitualConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
