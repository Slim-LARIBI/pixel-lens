import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { db } from "./db";
import { WorkspaceMember } from "@prisma/client";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function getUserWorkspaces(userId: string) {
  const memberships = await db.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return memberships.map((m) => ({
    ...m.workspace,
    role: m.role,
  }));
}

export async function getWorkspaceMembership(
  userId: string,
  workspaceId: string
): Promise<WorkspaceMember | null> {
  return db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });
}

export async function requireWorkspaceAccess(workspaceId: string) {
  const user = await requireAuth();
  const membership = await getWorkspaceMembership(user.id, workspaceId);

  if (!membership) {
    throw new Error("Access denied to this workspace");
  }

  return { user, membership };
}
