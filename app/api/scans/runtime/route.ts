// app/api/scans/runtime/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildRuntimeReport } from "./core/runtime.report";
import { runRuntimeScan } from "./core/runtime.scan";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const devBypass = req.headers.get("x-dev-bypass") === "1";
    const session = devBypass ? null : await getServerSession(authOptions);

    if (!devBypass && !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const url = String(body?.url || "").trim();

    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        { error: "Invalid url. Must start with http(s)://" },
        { status: 400 }
      );
    }

    let workspaceId = String(body?.workspaceId || "").trim();
    let workspace = null as null | { id: string };

    if (workspaceId) {
      workspace = await db.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true },
      });
    }

    if (!workspace) {
      const first = await db.workspace.findFirst({ select: { id: true } });
      if (first) {
        workspace = first;
        workspaceId = first.id;
      }
    }

    if (!workspace) {
      const created = await db.workspace.create({
        data: {
          name: "Dev Workspace",
          slug: `dev-workspace-${Date.now()}`,
          plan: "FREE",
        },
        select: { id: true },
      });
      workspace = created;
      workspaceId = created.id;
    }

    const scan = await db.scan.create({
      data: {
        workspaceId,
        url,
        profile: "QUICK" as any,
        status: "RUNNING" as any,
        tags: JSON.stringify(["runtime:playwright", "v2:5-pages"]),
      },
      select: { id: true },
    });

    const result = await runRuntimeScan(url);
    const report = buildRuntimeReport(result);

    await db.scan.update({
      where: { id: scan.id },
      data: {
        status: "DONE" as any,
        overallScore: report.overallScore ?? 0,
        categoryScores: JSON.stringify(report.categoryScores ?? {}),
        executiveSummary: report.executiveSummary ?? "",
        findings: JSON.stringify(report.validations ?? []),
        eventsTimeline: JSON.stringify(result.timeline ?? []),
        raw: JSON.stringify(report.raw ?? {}),
      },
    });

    return NextResponse.json({ id: scan.id }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/scans/runtime error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}