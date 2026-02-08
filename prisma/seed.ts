import { PrismaClient, WorkspacePlan, ScanProfile, ScanStatus, WorkspaceMemberRole } from "@prisma/client";
import { mockScan } from "../lib/scanner/mock-scanner";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create a demo user
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@pixellens.com" },
    update: {},
    create: {
      email: "demo@pixellens.com",
      name: "Demo User",
    },
  });

  console.log("✅ Created demo user");

  // Create a demo workspace
  const demoWorkspace = await prisma.workspace.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo Workspace",
      slug: "demo",
      plan: WorkspacePlan.PRO,
      members: {
        create: {
          userId: demoUser.id,
          role: WorkspaceMemberRole.OWNER,
        },
      },
    },
  });

  console.log("✅ Created demo workspace");

  // Initialize usage
  const currentMonth = new Date().toISOString().slice(0, 7);
  await prisma.usage.upsert({
    where: {
      workspaceId_month: {
        workspaceId: demoWorkspace.id,
        month: currentMonth,
      },
    },
    update: {},
    create: {
      workspaceId: demoWorkspace.id,
      month: currentMonth,
      scansCount: 1,
      deepScansCount: 0,
    },
  });

  console.log("✅ Initialized usage tracking");

  // Create a sample completed scan
  const existingScan = await prisma.scan.findFirst({
    where: {
      workspaceId: demoWorkspace.id,
      url: "https://demo-store.example.com",
    },
  });

  if (!existingScan) {
    console.log("🔍 Generating sample scan...");
    const scanResult = await mockScan("https://demo-store.example.com", ScanProfile.STANDARD);

    const demoScan = await prisma.scan.create({
      data: {
        workspaceId: demoWorkspace.id,
        url: "https://demo-store.example.com",
        profile: ScanProfile.STANDARD,
        status: ScanStatus.DONE,
        overallScore: scanResult.overallScore,
        categoryScores: JSON.stringify(scanResult.categoryScores),
        executiveSummary: scanResult.executiveSummary,
        findings: JSON.stringify(scanResult.findings),
        eventsTimeline: JSON.stringify(scanResult.eventsTimeline),
        payloads: JSON.stringify(scanResult.payloads),
        raw: JSON.stringify(scanResult.raw),
      },
    });

    console.log("✅ Created sample scan");

    // Create a public share link for the demo
    await prisma.shareLink.create({
      data: {
        scanId: demoScan.id,
        workspaceId: demoWorkspace.id,
        slug: "demo",
      },
    });

    console.log("✅ Created public share link");
  } else {
    console.log("ℹ️  Sample scan already exists, skipping");
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      workspaceId: demoWorkspace.id,
      actorUserId: demoUser.id,
      action: "seed.completed",
      metadata: JSON.stringify({ timestamp: new Date().toISOString() }),
    },
  });

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
