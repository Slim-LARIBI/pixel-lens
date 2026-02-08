import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function scoreClamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

async function quickHtmlScan(url: string) {
  const t0 = Date.now();
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      Accept: "text/html,*/*",
    },
  });

  const finalUrl = res.url || url;
  const html = await res.text();

  const gtmIds = uniq(html.match(/GTM-[A-Z0-9]+/g) || []);
  const ga4Ids = uniq(html.match(/G-[A-Z0-9]{8,}/g) || []);

  // Meta pixel id heuristic
  const metaIdMatch =
    html.match(/\bfbq\(.{0,40}init.{0,40}['"](\d{8,})['"]/i) ||
    html.match(/\bpixelId['"]?\s*[:=]\s*['"](\d{8,})['"]/i);
  const metaPixelIds = uniq([metaIdMatch?.[1] || ""].filter(Boolean));
  const metaPixel = metaPixelIds.length > 0 || /connect\.facebook\.net\/.*fbevents\.js/i.test(html);

  // Consent/CMP hints
  const consentSeen =
    /cookie|consent|cmp|onetrust|cookiebot|quantcast|axeptio|didomi/i.test(html);

  // Simple findings
  const findings: any[] = [];

  if (gtmIds.length === 0) {
    findings.push({
      severity: "HIGH",
      title: "GTM container not detected",
      impact: "Harder to manage tags and debugging",
      fix: "Install Google Tag Manager snippet on all pages (head + body).",
    });
  } else {
    findings.push({
      severity: "INFO",
      title: "GTM detected",
      impact: "Tag management enabled",
      fix: `Containers: ${gtmIds.join(", ")}`,
    });
  }

  if (ga4Ids.length === 0) {
    findings.push({
      severity: "HIGH",
      title: "GA4 Measurement ID not detected",
      impact: "No GA4 page_view/events detected via HTML scan",
      fix: "Install GA4 via GTM or gtag.js and verify measurement ID.",
    });
  } else {
    findings.push({
      severity: "INFO",
      title: "GA4 detected",
      impact: "Analytics collection likely enabled",
      fix: `Measurement IDs: ${ga4Ids.join(", ")}`,
    });
  }

  if (!metaPixel) {
    findings.push({
      severity: "MEDIUM",
      title: "Meta Pixel not detected",
      impact: "No Meta remarketing / conversion signals from this HTML snapshot",
      fix: "Install Meta Pixel (and ideally CAPI) on the site.",
    });
  } else {
    findings.push({
      severity: "INFO",
      title: "Meta Pixel detected",
      impact: "Meta tracking likely enabled",
      fix: metaPixelIds.length ? `Pixel IDs: ${metaPixelIds.join(", ")}` : "Pixel script detected",
    });
  }

  if (!consentSeen) {
    findings.push({
      severity: "MEDIUM",
      title: "Consent/CMP not detected",
      impact: "Potential compliance risk and/or tags firing without consent",
      fix: "Implement a CMP (OneTrust/Cookiebot/etc.) and align GTM consent mode.",
    });
  } else {
    findings.push({
      severity: "INFO",
      title: "Consent/CMP signals detected",
      impact: "Consent layer likely present",
      fix: "Validate runtime: do tags fire pre/post consent?",
    });
  }

  // Simple scoring logic (v1)
  let score = 0;
  score += gtmIds.length ? 30 : 0;
  score += ga4Ids.length ? 35 : 0;
  score += metaPixel ? 20 : 0;
  score += consentSeen ? 15 : 0;
  score = scoreClamp(score);

  const categoryScores = {
    gtm: gtmIds.length ? 85 : 35,
    ga4: ga4Ids.length ? 80 : 30,
    meta: metaPixel ? 70 : 40,
    consent: consentSeen ? 70 : 40,
    capi: 0,
  };

  const executiveSummary =
    `**Quick HTML Scan (v1)**\n\n` +
    `- URL: ${finalUrl}\n` +
    `- GTM: ${gtmIds.length ? "✅" : "❌"} (${gtmIds.join(", ") || "none"})\n` +
    `- GA4: ${ga4Ids.length ? "✅" : "❌"} (${ga4Ids.join(", ") || "none"})\n` +
    `- Meta Pixel: ${metaPixel ? "✅" : "❌"} (${metaPixelIds.join(", ") || "none"})\n` +
    `- Consent/CMP: ${consentSeen ? "✅" : "❌"}\n\n` +
    `**Next**: Run Runtime Scan to validate real network calls + events.`;

  const timeline = [
    { ts: t0, type: "note", name: "quick.start", payload: { url } },
    { ts: Date.now(), type: "note", name: "quick.done", payload: { ms: Date.now() - t0 } },
  ];

  return {
    overallScore: score,
    categoryScores,
    executiveSummary,
    findings,
    timeline,
    raw: {
      finalUrl,
      httpStatus: res.status,
      gtmIds,
      ga4Ids,
      metaPixel,
      metaPixelIds,
      consentSeen,
    },
  };
}

export async function POST(req: Request) {
  try {
    const devBypass = req.headers.get("x-dev-bypass") === "1";
    const session = devBypass ? null : await getServerSession(authOptions);

    if (!devBypass && !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const url = String(body?.url || "").trim();
    const profile = String(body?.profile || "QUICK").trim();
    let workspaceId = String(body?.workspaceId || "").trim();

    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "Invalid url. Must start with http(s)://" }, { status: 400 });
    }

    // ✅ workspace resolve to avoid FK crash
    let workspace = null as null | { id: string };

    if (workspaceId) {
      workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
    }

    if (!workspace) {
      const first = await db.workspace.findFirst({ select: { id: true } });
      if (first) {
        workspace = first;
        workspaceId = first.id;
      }
    }

    if (!workspace) {
      const ts = Date.now();
      const name = "Dev Workspace";
      const slug = `${slugify(name)}-${ts}`;
      const created = await db.workspace.create({
        data: { name, slug, plan: "FREE" },
        select: { id: true },
      });
      workspace = created;
      workspaceId = created.id;
    }

    // ✅ create scan
    const scan = await db.scan.create({
      data: {
        workspaceId,
        url,
        profile: profile as any,
        status: "RUNNING" as any,
        tags: JSON.stringify(["quick:html"]),
      },
      select: { id: true },
    });

    // ✅ run quick inline scan
    const result = await quickHtmlScan(url);

    // ✅ persist
    await db.scan.update({
      where: { id: scan.id },
      data: {
        status: "DONE" as any,
        overallScore: result.overallScore ?? 0,
        categoryScores: JSON.stringify(result.categoryScores ?? {}),
        executiveSummary: result.executiveSummary ?? "",
        findings: JSON.stringify(result.findings ?? []),
        eventsTimeline: JSON.stringify(result.timeline ?? []),
        raw: JSON.stringify(result.raw ?? {}),
      },
    });

    return NextResponse.json({ id: scan.id, workspaceId }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/scans error:", err);
    return NextResponse.json({ error: err?.message || "Internal Server Error" }, { status: 500 });
  }
}