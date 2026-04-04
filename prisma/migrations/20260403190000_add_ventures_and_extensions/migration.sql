-- CreateEnum
CREATE TYPE "VentureStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectPriority" AS ENUM ('P0', 'P1', 'P2', 'P3');

-- CreateTable
CREATE TABLE "Venture" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "status" "VentureStatus" NOT NULL DEFAULT 'ACTIVE',
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Venture_workspaceId_idx" ON "Venture"("workspaceId");
CREATE INDEX "Venture_workspaceId_status_idx" ON "Venture"("workspaceId", "status");

-- AddForeignKey
ALTER TABLE "Venture" ADD CONSTRAINT "Venture_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Project — add ventureId + projectPriority
ALTER TABLE "Project" ADD COLUMN "ventureId" TEXT;
ALTER TABLE "Project" ADD COLUMN "projectPriority" "ProjectPriority" NOT NULL DEFAULT 'P2';

-- CreateIndex
CREATE INDEX "Project_ventureId_idx" ON "Project"("ventureId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Task — add lastActivityAt
ALTER TABLE "Task" ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
