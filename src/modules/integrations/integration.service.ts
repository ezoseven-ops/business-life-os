import { prisma } from '@/lib/prisma'
import type { IntegrationType } from '@prisma/client'

export async function getIntegration(workspaceId: string, type: IntegrationType) {
  return prisma.integration.findUnique({
    where: {
      workspaceId_type: { workspaceId, type },
    },
  })
}

export async function upsertIntegration(
  workspaceId: string,
  type: IntegrationType,
  config: Record<string, unknown>,
) {
  return prisma.integration.upsert({
    where: {
      workspaceId_type: { workspaceId, type },
    },
    update: { config, enabled: true },
    create: { workspaceId, type, config, enabled: true },
  })
}

export async function disableIntegration(workspaceId: string, type: IntegrationType) {
  return prisma.integration.update({
    where: {
      workspaceId_type: { workspaceId, type },
    },
    data: { enabled: false },
  })
}

// Get all enabled integrations for a workspace
export async function getEnabledIntegrations(workspaceId: string) {
  return prisma.integration.findMany({
    where: { workspaceId, enabled: true },
  })
}
