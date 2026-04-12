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
