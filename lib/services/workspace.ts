import { db } from "@/lib/db";
import { WorkspacePlan, WorkspaceMemberRole } from "@prisma/client";
import { slugify, getCurrentMonth } from "@/lib/utils";

export async function createWorkspace(userId: string, name: string, slug?: string) {
  const workspaceSlug = slug || slugify(name);

  // Check if slug exists
  const existing = await db.workspace.findUnique({
    where: { slug: workspaceSlug },
  });

  if (existing) {
    throw new Error("Workspace with this name already exists");
  }

  const workspace = await db.workspace.create({
    data: {
      name,
      slug: workspaceSlug,
      plan: WorkspacePlan.FREE,
      members: {
        create: {
          userId,
          role: WorkspaceMemberRole.OWNER,
        },
      },
    },
  });

  // Initialize usage tracking
  await db.usage.create({
    data: {
      workspaceId: workspace.id,
      month: getCurrentMonth(),
      scansCount: 0,
      deepScansCount: 0,
    },
  });

  // Log creation
  await db.auditLog.create({
    data: {
      workspaceId: workspace.id,
      actorUserId: userId,
      action: "workspace.created",
      metadata: JSON.stringify({ name, slug: workspaceSlug }),
    },
  });

  return workspace;
}

export async function getWorkspaceUsage(workspaceId: string) {
  const month = getCurrentMonth();

  let usage = await db.usage.findUnique({
    where: {
      workspaceId_month: {
        workspaceId,
        month,
      },
    },
  });

  if (!usage) {
    usage = await db.usage.create({
      data: {
        workspaceId,
        month,
        scansCount: 0,
        deepScansCount: 0,
      },
    });
  }

  return usage;
}

export async function incrementUsage(workspaceId: string, isDeepScan: boolean) {
  const month = getCurrentMonth();

  await db.usage.upsert({
    where: {
      workspaceId_month: {
        workspaceId,
        month,
      },
    },
    update: {
      scansCount: { increment: 1 },
      ...(isDeepScan && { deepScansCount: { increment: 1 } }),
    },
    create: {
      workspaceId,
      month,
      scansCount: 1,
      deepScansCount: isDeepScan ? 1 : 0,
    },
  });
}
