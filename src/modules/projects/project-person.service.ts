import { prisma } from '@/lib/prisma';

// ——— PROJECT PERSON SERVICE (non-user associations) ———

export async function addProjectPerson(
  projectId: string,
  personId: string,
  role: string | null,
  workspaceId: string
) {
  // Verify project belongs to workspace
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
  });
  if (!project) throw new Error('Project not found in workspace');

  // Verify person belongs to workspace
  const person = await prisma.person.findFirst({
    where: { id: personId, workspaceId },
  });
  if (!person) throw new Error('Person not found in workspace');

  // Upsert to handle unique constraint gracefully
  return prisma.projectPerson.upsert({
    where: {
      personId_projectId: { personId, projectId },
    },
    update: { role },
    create: { personId, projectId, role },
    include: {
      person: { select: { id: true, name: true, email: true, company: true } },
    },
  });
}

export async function removeProjectPerson(
  projectId: string,
  personId: string,
  workspaceId: string
) {
  // Verify project belongs to workspace
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
  });
  if (!project) throw new Error('Project not found in workspace');

  return prisma.projectPerson.delete({
    where: {
      personId_projectId: { personId, projectId },
    },
  });
}

export async function getAvailablePeople(
  projectId: string,
  workspaceId: string
) {
  // Get IDs of people already attached to this project
  const existing = await prisma.projectPerson.findMany({
    where: { projectId },
    select: { personId: true },
  });
  const excludeIds = existing.map((e) => e.personId);

  // Return workspace people NOT already attached
  return prisma.person.findMany({
    where: {
      workspaceId,
      id: { notIn: excludeIds },
    },
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
    },
    orderBy: { name: 'asc' },
  });
}
