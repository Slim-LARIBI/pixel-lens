// app/api/scans/runtime/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type TimelineItem =
  | { ts: number; type: "request"; name: string; url: string; method: string }
  | { ts: number; type: "datalayer"; name: string; payload: any }
  | { ts: number; type: "note"; name: string; payload?: any }
  | { ts: number; type: "validation"; name: string; payload: any };

function now() {
  return Date.now();
}

function safeJson(x: any) {
  try {
    return JSON.parse(JSON.stringify(x));
  } catch {
    return String(x);
  }
}

function getParam(url: string, key: string) {
  try {
    const u = new URL(url);
    return u.searchParams.get(key);
  } catch {
    return null;
  }
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function scoreClamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function hasAnyText(haystack: string, needles: string[]) {
  const s = (haystack || "").toLowerCase();
  return needles.some((n) => s.includes(n.toLowerCase()));
}

/**
 * CMP auto-consent (best-effort)
 * - tries in main page + all frames (CMP often in iframe)
 */
async function tryAutoConsent(page: any, timeline: TimelineItem[]) {
  const candidates = [
    // Generic text buttons (FR/EN)
    'button:has-text("Accept")',
    'button:has-text("Accept all")',
    'button:has-text("I agree")',
    'button:has-text("Agree")',
    'button:has-text("Allow")',
    'button:has-text("OK")',
    'button:has-text("Got it")',
    'button:has-text("Tout accepter")',
    'button:has-text("Tout accepter et fermer")',
    'button:has-text("Accepter")',
    'button:has-text("J\\x27accepte")',
    'button:has-text("Autoriser")',
    'button:has-text("D\\x27accord")',

    // Common CMP selectors
    "#onetrust-accept-btn-handler",
    "button#onetrust-accept-btn-handler",
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
    "#qc-cmp2-ui button[mode='primary']",
    "[data-testid='accept-all']",
    "[data-qa='accept-all']",
    "[data-accept-all]",
    "button[aria-label*='accept' i]",
    "button[title*='accept' i]",
  ];

  await page.waitForTimeout(800);

  const tryInContext = async (ctx: any, ctxName: string) => {
    for (const sel of candidates) {
      try {
        const el = ctx.locator(sel).first();
        if ((await el.count()) > 0 && (await el.isVisible({ timeout: 500 }))) {
          await el.click({ timeout: 1200 });
          timeline.push({
            ts: now(),
            type: "note",
            name: "consent.click",
            payload: { selector: sel, where: ctxName },
          });
          await page.waitForTimeout(1500);
          return { clicked: true, selector: sel, where: ctxName };
        }
      } catch {
        // continue
      }
    }
    return { clicked: false as const };
  };

  // 1) try main page
  const mainTry = await tryInContext(page, "main");
  if (mainTry.clicked) return mainTry;

  // 2) try all frames (CMP often embedded)
  const frames = page.frames();
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    try {
      const r = await tryInContext(f, `frame:${i}`);
      if ((r as any).clicked) return r as any;
    } catch {
      // ignore
    }
  }

  timeline.push({ ts: now(), type: "note", name: "consent.click", payload: { clicked: false } });
  return { clicked: false };
}

/**
 * Try to navigate to a product-like page for view_item validation
 */
async function tryViewItemJourney(page: any, baseOrigin: string, timeline: TimelineItem[]) {
  const productKeywords = [
    "product",
    "produit",
    "shop",
    "boutique",
    "store",
    "item",
    "sku",
    "catalog",
    "categorie",
    "category",
    "panier",
    "cart",
  ];

  const links: string[] = await page.evaluate((origin: string) => {
    const out: string[] = [];
    const as = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[];
    for (const a of as) {
      const href = a.getAttribute("href") || "";
      if (!href) continue;
      if (href.startsWith("#")) continue;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) continue;

      let abs = href;
      try {
        abs = new URL(href, origin).toString();
      } catch {
        continue;
      }
      if (!abs.startsWith(origin)) continue;
      if (abs.includes("/wp-admin") || abs.includes("/wp-login")) continue;
      out.push(abs);
    }
    return Array.from(new Set(out)).slice(0, 120);
  }, baseOrigin);

  let target =
    links.find((u) => productKeywords.some((k) => u.toLowerCase().includes(k))) ||
    links.find((u) => u.startsWith(baseOrigin) && !u.includes("#")) ||
    null;

  if (!target) {
    timeline.push({ ts: now(), type: "note", name: "view_item.skip", payload: { reason: "no_internal_links" } });
    return { attempted: false, target: null as string | null, failed: false };
  }

  timeline.push({ ts: now(), type: "note", name: "view_item.target", payload: { target } });

  try {
    await page.goto(target, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1200);
    return { attempted: true, target, failed: false };
  } catch (e: any) {
    timeline.push({ ts: now(), type: "note", name: "view_item.fail", payload: { message: e?.message || String(e) } });
    return { attempted: true, target, failed: true };
  }
}

async function runRuntimeScan(url: string) {
  // Dynamic import to avoid bundler/edge issues
  const { chromium } = await import("playwright");

  const pagesVisited: string[] = [];
  const timeline: TimelineItem[] = [];

  const signals = {
    ga4Requests: 0,
    ga4MeasurementIds: [] as string[],
    gtmIds: [] as string[],
    metaPixel: false,
    metaPixelIds: [] as string[],
    fbqEvents: [] as string[],
    gtagEvents: [] as string[],
    dataLayerEvents: [] as string[],
    consentSeen: false,
  };

  const validation = {
    view_item: {
      attempted: false,
      target: null as string | null,
      ga4: false,
      datalayer: false,
      meta: false,
    },
  };

  const raw = {
    requests: [] as Array<{ url: string; method: string }>,
    finalUrl: url,
    htmlSnippets: {
      hasGtmInHtml: false,
      hasGa4InHtml: false,
      hasMetaInHtml: false,
    },
  };

  const ga4Ids = new Set<string>();
  const gtmIds = new Set<string>();
  const metaIds = new Set<string>();
  const dlEventNames = new Set<string>();
  const fbqEvents = new Set<string>();
  const gtagEvents = new Set<string>();

  function detectGa4Event(reqUrl: string) {
    const en = getParam(reqUrl, "en");
    return en || null;
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  page.on("request", (r: any) => {
    const reqUrl = String(r.url());
    const method = String(r.method());
    raw.requests.push({ url: reqUrl, method });

    // GTM (standard)
    if (reqUrl.includes("googletagmanager.com/gtm.js")) {
      const id = getParam(reqUrl, "id");
      if (id) gtmIds.add(id);
      timeline.push({ ts: now(), type: "request", name: "gtm.js", url: reqUrl, method });
    }

    // gtag.js
    if (reqUrl.includes("googletagmanager.com/gtag/js")) {
      const id = getParam(reqUrl, "id");
      if (id) ga4Ids.add(id);
      timeline.push({ ts: now(), type: "request", name: "gtag.js", url: reqUrl, method });
    }

    // GA4 collect (standard domain)
    if (reqUrl.includes("google-analytics.com/g/collect") || reqUrl.includes("google-analytics.com/g/")) {
      signals.ga4Requests += 1;
      const tid = getParam(reqUrl, "tid");
      if (tid) ga4Ids.add(tid);

      const ev = detectGa4Event(reqUrl);
      if (ev === "view_item") validation.view_item.ga4 = true;

      timeline.push({ ts: now(), type: "request", name: "ga4.collect", url: reqUrl, method });
    }

    // Meta pixel endpoint
    if (reqUrl.includes("facebook.com/tr")) {
      signals.metaPixel = true;
      const pid = getParam(reqUrl, "id") || getParam(reqUrl, "pid");
      if (pid) metaIds.add(pid);

      const ev = getParam(reqUrl, "ev");
      if (ev) {
        fbqEvents.add(ev);
        if (ev === "ViewContent") validation.view_item.meta = true;
      }

      timeline.push({ ts: now(), type: "request", name: "meta.tr", url: reqUrl, method });
    }

    // Consent hints
    if (hasAnyText(reqUrl, ["consent", "cmp", "onetrust", "cookiebot", "quantcast", "axeptio", "didomi"])) {
      signals.consentSeen = true;
    }
  });

  await page.addInitScript(() => {
    // @ts-ignore
    window.__PIXELLENS__ = { dl: [], gtag: [], fbq: [] };

    // @ts-ignore
    window.dataLayer = window.dataLayer || [];
    const dl = window.dataLayer;

    const originalPush = dl.push.bind(dl);
    dl.push = function (...args: any[]) {
      try {
        // @ts-ignore
        window.__PIXELLENS__.dl.push(args);
      } catch {}
      return originalPush(...args);
    };

    // @ts-ignore
    const oldGtag = window.gtag;
    // @ts-ignore
    window.gtag = function (...args: any[]) {
      try {
        // @ts-ignore
        window.__PIXELLENS__.gtag.push(args);
      } catch {}
      // @ts-ignore
      if (typeof oldGtag === "function") return oldGtag(...args);
    };

    // @ts-ignore
    const oldFbq = window.fbq;
    // @ts-ignore
    window.fbq = function (...args: any[]) {
      try {
        // @ts-ignore
        window.__PIXELLENS__.fbq.push(args);
      } catch {}
      // @ts-ignore
      if (typeof oldFbq === "function") return oldFbq(...args);
    };
  });

  try {
    // 1) Load homepage
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    pagesVisited.push(page.url());
    raw.finalUrl = page.url();

    // Small interaction to trigger some tags
    await page.waitForTimeout(800);
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(800);

    // 2) Auto-consent (best effort)
    const consent = await tryAutoConsent(page, timeline);
    if ((consent as any).clicked) signals.consentSeen = true;

    // 3) Backup detect IDs from HTML
    const html = await page.content();
    const htmlGtm = uniq(html.match(/GTM-[A-Z0-9]+/g) || []);
    const htmlGa4 = uniq(html.match(/G-[A-Z0-9]{8,}/g) || []);

    htmlGtm.forEach((x) => gtmIds.add(x));
    htmlGa4.forEach((x) => ga4Ids.add(x));

    const mpMatch = html.match(/\bfbq\(.{0,80}init.{0,80}['"](\d{8,})['"]/i);
    if (mpMatch?.[1]) {
      signals.metaPixel = true;
      metaIds.add(mpMatch[1]);
    }

    raw.htmlSnippets.hasGtmInHtml = htmlGtm.length > 0;
    raw.htmlSnippets.hasGa4InHtml = htmlGa4.length > 0;
    raw.htmlSnippets.hasMetaInHtml = !!mpMatch?.[1];

    // 4) Try "view_item" journey
    const baseOrigin = new URL(url).origin;
    const vi = await tryViewItemJourney(page, baseOrigin, timeline);
    validation.view_item.attempted = !!vi.attempted;
    validation.view_item.target = vi.target || null;
    if (vi.attempted && !vi.failed) pagesVisited.push(page.url());

    // 5) Extract captured runtime hooks (dataLayer/gtag/fbq)
    const hooks = await page.evaluate(() => {
      // @ts-ignore
      const p = (window as any).__PIXELLENS__ || {};
      return {
        dl: p.dl || [],
        gtag: p.gtag || [],
        fbq: p.fbq || [],
      };
    });

    for (const entry of hooks.dl as any[]) {
      const first = entry?.[0];
      if (first && typeof first === "object") {
        const ev = first.event ? String(first.event) : "dataLayer.push";
        dlEventNames.add(ev);

        timeline.push({ ts: now(), type: "datalayer", name: ev, payload: safeJson(first) });

        if (String(first.event || "").toLowerCase() === "view_item") {
          validation.view_item.datalayer = true;
        }
      } else {
        dlEventNames.add("dataLayer.push");
        timeline.push({ ts: now(), type: "datalayer", name: "dataLayer.push", payload: safeJson(entry) });
      }
    }

    for (const args of hooks.gtag as any[]) {
      const t0 = String(args?.[0] || "");
      const t1 = String(args?.[1] || "");
      if (t0 === "event" && t1) {
        gtagEvents.add(t1);
        if (t1 === "view_item") validation.view_item.ga4 = true;
      }
    }

    for (const args of hooks.fbq as any[]) {
      const t0 = String(args?.[0] || "");
      const t1 = String(args?.[1] || "");
      if ((t0 === "track" || t0 === "trackCustom") && t1) {
        fbqEvents.add(t1);
        if (t1 === "ViewContent") validation.view_item.meta = true;
      }
    }

    // 6) Finalize signals
    signals.gtmIds = Array.from(gtmIds);
    signals.ga4MeasurementIds = Array.from(ga4Ids);
    signals.metaPixelIds = Array.from(metaIds);
    signals.dataLayerEvents = Array.from(dlEventNames);
    signals.fbqEvents = Array.from(fbqEvents);
    signals.gtagEvents = Array.from(gtagEvents);

    timeline.push({
      ts: now(),
      type: "validation",
      name: "view_item",
      payload: {
        attempted: validation.view_item.attempted,
        target: validation.view_item.target,
        ga4: validation.view_item.ga4,
        datalayer: validation.view_item.datalayer,
        meta: validation.view_item.meta,
        note:
          "GA4 view_item detected via en=view_item OR gtag('event','view_item') OR dataLayer event='view_item'. Meta mapped to ViewContent best-effort.",
      },
    });

    return { pagesVisited, signals, validation, timeline, raw };
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

function buildRuntimeReport(result: Awaited<ReturnType<typeof runRuntimeScan>>) {
  const { signals, validation } = result;

  // Scoring v1
  let score = 0;
  score += signals.gtmIds.length ? 30 : 0;
  score += signals.ga4Requests > 0 || signals.ga4MeasurementIds.length ? 35 : 0;
  score += signals.metaPixel ? 20 : 0;
  score += signals.consentSeen ? 15 : 0;
  score += validation.view_item.ga4 || validation.view_item.datalayer ? 10 : 0; // bonus validation
  score = scoreClamp(score);

  const categoryScores = {
    gtm: signals.gtmIds.length ? 100 : 35,
    ga4: signals.ga4Requests > 0 || signals.ga4MeasurementIds.length ? 80 : 30,
    meta: signals.metaPixel ? 80 : 0,
    capi: 0,
  };

  const findings: any[] = [];

  if (!signals.gtmIds.length) {
    findings.push({
      severity: "HIGH",
      title: "GTM not detected",
      impact: "Tag management + ecommerce instrumentation harder to scale",
      fix: "Install Google Tag Manager snippet (head + body) on all pages.",
    });
  } else {
    findings.push({
      severity: "INFO",
      title: "GTM detected",
      impact: "Tag management enabled",
      fix: `Detected GTM container(s): ${signals.gtmIds.join(", ")}`,
    });
  }

  if (!(signals.ga4Requests > 0 || signals.ga4MeasurementIds.length)) {
    findings.push({
      severity: "HIGH",
      title: "No GA4 hits detected at runtime",
      impact: "No page_view/events observed during headless journey",
      fix: "Verify GA4 tag firing in GTM + check consent mode + test without bot protections.",
    });
  } else {
    findings.push({
      severity: "INFO",
      title: "GA4 detected",
      impact: "GA4 network calls observed",
      fix: `Measurement IDs: ${signals.ga4MeasurementIds.join(", ") || "detected via requests"}`,
    });
  }

  if (!signals.metaPixel) {
    findings.push({
      severity: "MEDIUM",
      title: "Meta Pixel not detected",
      impact: "No Meta remarketing/conversion signals observed",
      fix: "Install Meta Pixel (and ideally CAPI) and validate PageView/ViewContent.",
    });
  } else {
    findings.push({
      severity: "INFO",
      title: "Meta Pixel detected",
      impact: "Meta tracking observed",
      fix: signals.metaPixelIds.length ? `Pixel IDs: ${signals.metaPixelIds.join(", ")}` : "facebook.com/tr observed",
    });
  }

  if (!signals.consentSeen) {
    findings.push({
      severity: "MEDIUM",
      title: "Consent/CMP not detected",
      impact: "Possible compliance + tags might fire before consent",
      fix: "Implement CMP + align GTM consent mode.",
    });
  }

  if (!validation.view_item.ga4 && !validation.view_item.datalayer) {
    findings.push({
      severity: "HIGH",
      title: "view_item validation",
      impact: "No view_item detected during product-like navigation",
      fix: "Implement ecommerce view_item (dataLayer/gtag) and verify parameters.",
    });
  }

  const executiveSummary =
    `**Phase 2 Runtime Scan (Playwright)**\n\n` +
    `Detected:\n` +
    `- GA4 IDs: ${signals.ga4MeasurementIds.join(", ") || "none"}\n` +
    `- GTM IDs: ${signals.gtmIds.join(", ") || "none"}\n` +
    `- Meta Pixel: ${signals.metaPixel ? "yes" : "no"}\n` +
    `- Consent: ${signals.consentSeen ? "detected" : "not detected"}\n\n` +
    `view_item:\n` +
    `- attempted: ${validation.view_item.attempted ? "yes" : "no"}\n` +
    `- GA4: ${validation.view_item.ga4 ? "yes" : "no"}\n` +
    `- dataLayer: ${validation.view_item.datalayer ? "yes" : "no"}\n\n` +
    `**Next**: auto-consent improvements + add_to_cart/purchase validations.`;

  return { overallScore: score, categoryScores, executiveSummary, findings };
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

    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "Invalid url. Must start with http(s)://" }, { status: 400 });
    }

    // Resolve workspace safely (avoid FK crashes)
    let workspaceId = String(body?.workspaceId || "").trim();
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
      const created = await db.workspace.create({
        data: { name: "Dev Workspace", slug: `dev-workspace-${Date.now()}`, plan: "FREE" },
        select: { id: true },
      });
      workspace = created;
      workspaceId = created.id;
    }

    // Create scan
    const scan = await db.scan.create({
      data: {
        workspaceId,
        url,
        profile: "RUNTIME" as any,
        status: "RUNNING" as any,
        tags: JSON.stringify(["runtime:playwright"]),
      },
      select: { id: true },
    });

    // Run scan
    const result = await runRuntimeScan(url);
    const report = buildRuntimeReport(result);

    // Persist results
    await db.scan.update({
      where: { id: scan.id },
      data: {
        status: "DONE" as any,
        overallScore: report.overallScore ?? 0,
        categoryScores: JSON.stringify(report.categoryScores ?? {}),
        executiveSummary: report.executiveSummary ?? "",
        findings: JSON.stringify(report.findings ?? []),
        eventsTimeline: JSON.stringify(result.timeline ?? []),
        raw: JSON.stringify(result.raw ?? {}),
      },
    });

    // Return scan id (IMPORTANT for UI)
    return NextResponse.json({ id: scan.id }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/scans/runtime error:", err);
    return NextResponse.json({ error: err?.message || "Internal Server Error" }, { status: 500 });
  }
}