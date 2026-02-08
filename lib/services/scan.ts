import { db } from "@/lib/db";
import { ScanProfile, ScanStatus, WorkspacePlan } from "@prisma/client";
import { mockScan } from "@/lib/scanner/mock-scanner";
import { getPlanLimits, canUseProfile } from "@/lib/plans";
import { getWorkspaceUsage, incrementUsage } from "./workspace";

export async function createScan(workspaceId: string, url: string, profile: ScanProfile, actorUserId: string) {
  // Get workspace
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  // Check plan limits
  const limits = getPlanLimits(workspace.plan);
  const usage = await getWorkspaceUsage(workspaceId);

  // Check scan limit
  if (usage.scansCount >= limits.scansPerMonth) {
    throw new Error(`Scan limit reached. Upgrade to ${workspace.plan === WorkspacePlan.FREE ? "Starter" : "Pro"} for more scans.`);
  }

  // Check profile allowed
  if (!canUseProfile(workspace.plan, profile)) {
    throw new Error(`${profile} scans not available on ${limits.name} plan. Please upgrade.`);
  }

  // Create scan
  const scan = await db.scan.create({
    data: {
      workspaceId,
      url,
      profile,
      status: ScanStatus.QUEUED,
    },
  });

  // Log
  await db.auditLog.create({
    data: {
      workspaceId,
      actorUserId,
      action: "scan.created",
      metadata: JSON.stringify({ scanId: scan.id, url, profile }),
    },
  });

  // Run scan async (in production, this would be a queue job)
  runScan(scan.id, url, profile, workspaceId).catch(console.error);

  return scan;
}

async function runScan(scanId: string, url: string, profile: ScanProfile, workspaceId: string) {
  try {
    // Update status
    await db.scan.update({
      where: { id: scanId },
      data: { status: ScanStatus.RUNNING },
    });

    // Run mock scan
    const result = await mockScan(url, profile);

    // Save results
    await db.scan.update({
      where: { id: scanId },
      data: {
        status: ScanStatus.DONE,
        overallScore: result.overallScore,
        categoryScores: JSON.stringify(result.categoryScores),
        executiveSummary: result.executiveSummary,
        findings: JSON.stringify(result.findings),
        eventsTimeline: JSON.stringify(result.eventsTimeline),
        payloads: JSON.stringify(result.payloads),
        raw: JSON.stringify(result.raw),
      },
    });

    // Increment usage
    await incrementUsage(workspaceId, profile === ScanProfile.DEEP);
  } catch (error: any) {
    await db.scan.update({
      where: { id: scanId },
      data: {
        status: ScanStatus.FAILED,
        errorMessage: error.message || "Unknown error",
      },
    });
  }
}

export async function deleteScan(scanId: string, workspaceId: string, actorUserId: string) {
  const scan = await db.scan.findFirst({
    where: { id: scanId, workspaceId },
  });

  if (!scan) {
    throw new Error("Scan not found");
  }

  await db.scan.delete({
    where: { id: scanId },
  });

  await db.auditLog.create({
    data: {
      workspaceId,
      actorUserId,
      action: "scan.deleted",
      metadata: JSON.stringify({ scanId, url: scan.url }),
    },
  });
}
