import { NextResponse } from "next/server";
import { quickScan } from "@/lib/scanner/quick";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const url = String(body?.url || "").trim();
  const workspaceId = String(body?.workspaceId || "").trim();

  if (!url || !workspaceId) {
    return NextResponse.json({ error: "Missing url/workspaceId" }, { status: 400 });
  }

  // Check membership
  const member = await db.workspaceMember.findFirst({
    where: {
      workspaceId,
      // @ts-ignore
      userId: session.user.id,
    },
  });

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Create scan record (QUEUED -> RUNNING -> DONE)
  const scan = await db.scan.create({
    data: {
      workspaceId,
      url,
      profile: "QUICK",
      status: "RUNNING",
      tags: JSON.stringify(["quick:real"]),
    },
  });

  try {
    const result = await quickScan(url);

    // Convert findings to stored strings
    const findings = result.findings;
    const categoryScores = result.categoryScores;

    await db.scan.update({
      where: { id: scan.id },
      data: {
        status: "DONE",
        overallScore: result.overallScore,
        categoryScores: JSON.stringify(categoryScores),
        findings: JSON.stringify(findings),
        executiveSummary: [
          `Overall Score: **${result.overallScore}/100**`,
          ``,
          `Detected:`,
          `- GA4 IDs: ${result.signals.ga4Ids.length ? result.signals.ga4Ids.join(", ") : "none"}`,
          `- GTM IDs: ${result.signals.gtmIds.length ? result.signals.gtmIds.join(", ") : "none"}`,
          `- Meta Pixel: ${result.signals.hasMetaPixel ? "yes" : "no"}`,
          `- CMP: ${result.signals.cmpProviders.length ? result.signals.cmpProviders.join(", ") : "unknown"}`,
          ``,
          `Note: This is a **Phase 1 QUICK scan** (HTML-based). Runtime event validation (view_item/purchase) is Phase 2.`,
        ].join("\n"),
        raw: JSON.stringify(result.raw),
      },
    });

    return NextResponse.json({ scanId: scan.id, result });
  } catch (e: any) {
    await db.scan.update({
      where: { id: scan.id },
      data: {
        status: "FAILED",
        errorMessage: e?.message ? String(e.message) : "Scan failed",
      },
    });

    return NextResponse.json(
      { error: e?.message ? String(e.message) : "Scan failed" },
      { status: 500 }
    );
  }
}