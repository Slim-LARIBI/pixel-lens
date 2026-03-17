// app/api/scans/runtime/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Status = "CONFIRMED" | "NOT_CONFIRMED" | "UNVERIFIED" | "PARTIAL";
type Confidence = "HIGH" | "MEDIUM" | "LOW";

type ValidationCheck = {
  check: string;
  status: Status;
  confidence: Confidence;
  evidence?: string;
  action?: string;
};

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

function inferPlatform(
  url: string,
  html: string,
  requests: Array<{ url: string; method: string }>
) {
  const all = `${url}\n${html}\n${requests.map((r) => r.url).join("\n")}`.toLowerCase();

  if (
    all.includes("woocommerce") ||
    all.includes("/wp-content/plugins/woocommerce") ||
    all.includes("wc-ajax")
  ) {
    return "WooCommerce";
  }

  if (
    all.includes("shopify") ||
    all.includes("/cdn/shop/") ||
    all.includes("shopify-payment-button")
  ) {
    return "Shopify";
  }

  if (all.includes("prestashop")) return "PrestaShop";
  if (all.includes("magento")) return "Magento";

  return "Unknown";
}

function inferPageType(url: string) {
  const s = (url || "").toLowerCase();

  if (
    s.includes("/product/") ||
    s.includes("/produit/") ||
    s.includes("/shop/") ||
    s.includes("/boutique/")
  ) {
    return "Product";
  }

  if (s.includes("/cart") || s.includes("/panier")) return "Cart";
  if (s.includes("/checkout") || s.includes("/commande")) return "Checkout";
  if (s.includes("/category") || s.includes("/categorie")) return "Category";

  return "Unknown";
}
// =========================================================
// META MODULE — TYPES
// =========================================================

type MetaPayloadRecord = {
  cmd?: string;
  event?: string;
  params?: Record<string, any>;
  ts?: number;
};

type MetaEventAudit = {
  event: string;
  count: number;
  requiredParams: string[];
  presentParams: string[];
  missingParams: string[];
  payloadQualityScore: number;
  criticalIssues: string[];
  samples: Array<Record<string, any>>;
};

type MetaFunnelStep = {
  step: "ViewContent" | "AddToCart" | "Purchase";
  detected: boolean;
  count: number;
  payloadQualityScore: number;
  criticalIssues: string[];
  status: "OK" | "PARTIAL" | "MISSING";
};

type MetaInsight = {
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  impact: string;
  action: string;
};

// =========================================================
// META MODULE — NORMALIZATION
// =========================================================

function normalizeMetaEventName(eventName: string) {
  const e = String(eventName || "").trim();
  if (!e) return "";

  const mapping: Record<string, string> = {
    ViewContent: "ViewContent",
    AddToCart: "AddToCart",
    InitiateCheckout: "InitiateCheckout",
    Purchase: "Purchase",
    PageView: "PageView",
    Lead: "Lead",
    CompleteRegistration: "CompleteRegistration",
  };

  return mapping[e] || e;
}

function getMetaRequiredParams(eventName: string) {
  switch (eventName) {
    case "ViewContent":
      return ["content_ids", "content_type"];
    case "AddToCart":
      return ["content_ids", "content_type", "value", "currency"];
    case "Purchase":
      return ["value", "currency"];
    case "InitiateCheckout":
      return ["value", "currency"];
    default:
      return [];
  }
}

// =========================================================
// META MODULE — VALUE HELPERS
// =========================================================

function hasMeaningfulValue(value: any) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function isNumericLike(value: any) {
  if (typeof value === "number") return !Number.isNaN(value);
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return true;
  }
  return false;
}

function getNumericValue(value: any) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return NaN;
}

function isNonEmptyString(value: any) {
  return typeof value === "string" && value.trim() !== "";
}

// =========================================================
// META MODULE — CRITICAL ISSUES
// =========================================================

function buildMetaCriticalIssues(eventName: string, samples: MetaPayloadRecord[]) {
  const issues = new Set<string>();

  for (const sample of samples) {
    const params = sample?.params || {};

    // ------------------------------------------------------
    // ViewContent / AddToCart core ecommerce rules
    // ------------------------------------------------------
    if (
      ["ViewContent", "AddToCart"].includes(eventName) &&
      !hasMeaningfulValue(params.content_ids)
    ) {
      issues.add("content_ids missing");
    }

    if (
      ["ViewContent", "AddToCart"].includes(eventName) &&
      hasMeaningfulValue(params.content_ids) &&
      !Array.isArray(params.content_ids)
    ) {
      issues.add("content_ids should be an array");
    }

    if (
      ["ViewContent", "AddToCart"].includes(eventName) &&
      !hasMeaningfulValue(params.content_type)
    ) {
      issues.add("content_type missing");
    }

    // ------------------------------------------------------
    // AddToCart / Purchase / InitiateCheckout value rules
    // ------------------------------------------------------
    if (
      ["AddToCart", "InitiateCheckout", "Purchase"].includes(eventName) &&
      !hasMeaningfulValue(params.currency)
    ) {
      issues.add("currency missing");
    }

    if (
      ["AddToCart", "InitiateCheckout", "Purchase"].includes(eventName) &&
      hasMeaningfulValue(params.currency) &&
      !isNonEmptyString(params.currency)
    ) {
      issues.add("currency should be a string");
    }

    if (
      ["AddToCart", "InitiateCheckout", "Purchase"].includes(eventName) &&
      !hasMeaningfulValue(params.value)
    ) {
      issues.add("value missing");
    }

    if (
      ["AddToCart", "InitiateCheckout", "Purchase"].includes(eventName) &&
      hasMeaningfulValue(params.value) &&
      !isNumericLike(params.value)
    ) {
      issues.add("value should be numeric");
    }

    if (
      ["AddToCart", "InitiateCheckout", "Purchase"].includes(eventName) &&
      isNumericLike(params.value) &&
      getNumericValue(params.value) <= 0
    ) {
      issues.add("value should be greater than 0");
    }

    // ------------------------------------------------------
    // Purchase-specific rules
    // ------------------------------------------------------
    if (
      eventName === "Purchase" &&
      !hasMeaningfulValue(params.contents) &&
      !hasMeaningfulValue(params.content_ids)
    ) {
      issues.add("purchase should contain contents or content_ids");
    }

    // ------------------------------------------------------
    // Optional ecommerce structure validation
    // ------------------------------------------------------
    if (
      hasMeaningfulValue(params.contents) &&
      !Array.isArray(params.contents)
    ) {
      issues.add("contents should be an array");
    }
  }

  return Array.from(issues);
}

// =========================================================
// META MODULE — EVENT AUDIT
// =========================================================

function buildMetaAudit(metaPayloads: MetaPayloadRecord[]) {
  const grouped = new Map<string, MetaPayloadRecord[]>();

  for (const entry of metaPayloads || []) {
    const normalizedEvent = normalizeMetaEventName(String(entry?.event || ""));
    if (!normalizedEvent) continue;

    // Keep only the key Meta ecommerce events for now
    if (!["ViewContent", "AddToCart", "Purchase"].includes(normalizedEvent)) {
      continue;
    }

    if (!grouped.has(normalizedEvent)) {
      grouped.set(normalizedEvent, []);
    }

    grouped.get(normalizedEvent)!.push(entry);
  }

  const audits: MetaEventAudit[] = [];

  for (const [event, items] of grouped.entries()) {
    const requiredParams = getMetaRequiredParams(event);

    const paramSet = new Set<string>();
    for (const item of items) {
      const params = item?.params || {};
      for (const key of Object.keys(params)) {
        if (hasMeaningfulValue(params[key])) {
          paramSet.add(key);
        }
      }
    }

    const presentParams = Array.from(paramSet).sort();
    const missingParams = requiredParams.filter((p) => !paramSet.has(p));
    const criticalIssues = buildMetaCriticalIssues(event, items);

    const matchedRequiredCount = presentParams.filter((p) =>
      requiredParams.includes(p)
    ).length;

    let payloadQualityScore =
      requiredParams.length === 0
        ? 100
        : Math.round((matchedRequiredCount / requiredParams.length) * 100);

    // Penalize critical issues
    if (criticalIssues.length > 0) {
      payloadQualityScore = Math.max(0, payloadQualityScore - criticalIssues.length * 15);
    }

    audits.push({
      event,
      count: items.length,
      requiredParams,
      presentParams,
      missingParams,
      payloadQualityScore,
      criticalIssues,
      samples: items.slice(0, 3).map((x) => ({
        params: x.params || {},
        ts: x.ts || null,
      })),
    });
  }

  const preferredOrder = ["ViewContent", "AddToCart", "Purchase"];

  return audits.sort(
    (a, b) => preferredOrder.indexOf(a.event) - preferredOrder.indexOf(b.event)
  );
}

// =========================================================
// META MODULE — FUNNEL ENGINE
// =========================================================

function buildMetaFunnel(metaAudit: MetaEventAudit[]) {
  const getEvent = (name: string) =>
    metaAudit.find((item) => item.event === name);

  const viewContent = getEvent("ViewContent");
  const addToCart = getEvent("AddToCart");
  const purchase = getEvent("Purchase");

  const steps: MetaFunnelStep[] = [
    {
      step: "ViewContent",
      detected: !!viewContent,
      count: viewContent?.count || 0,
      payloadQualityScore: viewContent?.payloadQualityScore || 0,
      criticalIssues: viewContent?.criticalIssues || [],
      status: !viewContent
        ? "MISSING"
        : viewContent.payloadQualityScore >= 80 &&
          (viewContent.criticalIssues?.length || 0) === 0
        ? "OK"
        : "PARTIAL",
    },
    {
      step: "AddToCart",
      detected: !!addToCart,
      count: addToCart?.count || 0,
      payloadQualityScore: addToCart?.payloadQualityScore || 0,
      criticalIssues: addToCart?.criticalIssues || [],
      status: !addToCart
        ? "MISSING"
        : addToCart.payloadQualityScore >= 80 &&
          (addToCart.criticalIssues?.length || 0) === 0
        ? "OK"
        : "PARTIAL",
    },
    {
      step: "Purchase",
      detected: !!purchase,
      count: purchase?.count || 0,
      payloadQualityScore: purchase?.payloadQualityScore || 0,
      criticalIssues: purchase?.criticalIssues || [],
      status: !purchase
        ? "MISSING"
        : purchase.payloadQualityScore >= 80 &&
          (purchase.criticalIssues?.length || 0) === 0
        ? "OK"
        : "PARTIAL",
    },
  ];

  let score = 0;
  for (const step of steps) {
    if (step.status === "OK") score += 100 / 3;
    else if (step.status === "PARTIAL") score += 50 / 3;
  }

  const roundedScore = Math.round(score);

  let mainRisk = "No major Meta funnel risk detected";
  if (steps.find((s) => s.step === "Purchase" && s.status === "MISSING")) {
    mainRisk = "Purchase event missing";
  } else if (steps.find((s) => s.step === "AddToCart" && s.status === "MISSING")) {
    mainRisk = "AddToCart event missing";
  } else if (steps.find((s) => s.step === "ViewContent" && s.status === "MISSING")) {
    mainRisk = "ViewContent event missing";
  } else {
    const partial = steps.find((s) => s.status === "PARTIAL");
    if (partial) {
      mainRisk = `${partial.step} payload quality needs review`;
    }
  }

  return {
    score: roundedScore,
    mainRisk,
    steps,
  };
}

// =========================================================
// META MODULE — INSIGHTS ENGINE
// =========================================================

function buildMetaInsights(
  metaAudit: MetaEventAudit[],
  metaFunnel: ReturnType<typeof buildMetaFunnel>
) {
  const insights: MetaInsight[] = [];

  const getStep = (name: "ViewContent" | "AddToCart" | "Purchase") =>
    metaFunnel.steps.find((s) => s.step === name);

  const viewContent = getStep("ViewContent");
  const addToCart = getStep("AddToCart");
  const purchase = getStep("Purchase");

  // ------------------------------------------------------
  // Funnel-level insights
  // ------------------------------------------------------
  if (purchase?.status === "MISSING") {
    insights.push({
      priority: "HIGH",
      title: "Purchase event missing",
      impact: "Revenue tracking is incomplete and ROAS reporting may be unreliable in Meta.",
      action: "Validate Purchase firing on the confirmation page and confirm value/currency are sent.",
    });
  }

  if (addToCart?.status === "MISSING") {
    insights.push({
      priority: "HIGH",
      title: "AddToCart event missing",
      impact: "Meta may lose key optimization signals for lower-funnel intent.",
      action: "Validate AddToCart firing on product pages and cart interactions.",
    });
  }

  if (viewContent?.status === "MISSING") {
    insights.push({
      priority: "MEDIUM",
      title: "ViewContent event missing",
      impact: "Product view signals are incomplete, which can reduce catalog and retargeting quality.",
      action: "Validate ViewContent firing on product detail pages.",
    });
  }

  // ------------------------------------------------------
  // Cross-event consistency insights
  // ------------------------------------------------------
  if (purchase?.detected && !addToCart?.detected) {
    insights.push({
      priority: "MEDIUM",
      title: "Purchase detected without AddToCart",
      impact: "The Meta funnel is inconsistent and lower-funnel behavior may be under-tracked.",
      action: "Review AddToCart implementation and confirm it fires before checkout steps.",
    });
  }

  if (addToCart?.detected && !viewContent?.detected) {
    insights.push({
      priority: "MEDIUM",
      title: "AddToCart detected without ViewContent",
      impact: "Meta receives cart intent signals but misses product view context, reducing funnel clarity.",
      action: "Review ViewContent implementation on product detail pages.",
    });
  }

  // ------------------------------------------------------
  // Payload-level insights
  // ------------------------------------------------------
  for (const eventAudit of metaAudit) {
    if (eventAudit.missingParams.length > 0) {
      insights.push({
        priority: "HIGH",
        title: `${eventAudit.event} missing required params`,
        impact: "Meta may receive incomplete ecommerce data, which can degrade attribution and optimization quality.",
        action: `Add the missing params for ${eventAudit.event}: ${eventAudit.missingParams.join(", ")}.`,
      });
    }

    if (eventAudit.criticalIssues.length > 0) {
      insights.push({
        priority: "HIGH",
        title: `${eventAudit.event} has critical payload issues`,
        impact: "Meta may process the event incorrectly or with reduced ecommerce signal quality.",
        action: `Fix the critical issues for ${eventAudit.event}: ${eventAudit.criticalIssues.join(", ")}.`,
      });
    }

    if (
      eventAudit.payloadQualityScore < 100 &&
      eventAudit.payloadQualityScore >= 60 &&
      eventAudit.criticalIssues.length === 0 &&
      eventAudit.missingParams.length === 0
    ) {
      insights.push({
        priority: "MEDIUM",
        title: `${eventAudit.event} payload quality needs review`,
        impact: "The event is detected but payload quality is not fully optimal.",
        action: `Review optional ecommerce params for ${eventAudit.event} and validate payload consistency.`,
      });
    }
  }

  // ------------------------------------------------------
  // Positive signal
  // ------------------------------------------------------
  const strongCore =
    viewContent?.status === "OK" &&
    addToCart?.status === "OK" &&
    purchase?.status === "OK";

  if (strongCore) {
    insights.push({
      priority: "LOW",
      title: "Core Meta ecommerce funnel is healthy",
      impact: "Meta receives strong lower-funnel signals across the main ecommerce journey.",
      action: "Maintain monitoring and validate this setup regularly after site changes.",
    });
  }

  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };

  return insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

async function tryAutoConsent(page: any, timeline: TimelineItem[]) {
  const candidates = [
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
      } catch {}
    }
    return { clicked: false as const };
  };

  const mainTry = await tryInContext(page, "main");
  if (mainTry.clicked) return mainTry;

  const frames = page.frames();
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    try {
      const r = await tryInContext(f, `frame:${i}`);
      if ((r as any).clicked) return r as any;
    } catch {}
  }

  timeline.push({
    ts: now(),
    type: "note",
    name: "consent.click",
    payload: { clicked: false },
  });

  return { clicked: false };
}

async function tryAddToCart(page: any, timeline: TimelineItem[]) {
  const selectors = [
    'button[name="add-to-cart"]',
    '[name="add-to-cart"]',
    ".single_add_to_cart_button",
    ".add_to_cart_button",
    '[data-add-to-cart]',
    'button:has-text("Add to cart")',
    'button:has-text("Ajouter au panier")',
    'button:has-text("Ajouter")',
  ];

  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first();

      if ((await btn.count()) > 0 && (await btn.isVisible({ timeout: 1000 }))) {
        await btn.click({ timeout: 2000 });

        timeline.push({
          ts: now(),
          type: "note",
          name: "add_to_cart.click",
          payload: { selector: sel },
        });

        await page.waitForTimeout(2500);
        return { attempted: true, clicked: true, selector: sel };
      }
    } catch {}
  }

  timeline.push({
    ts: now(),
    type: "note",
    name: "add_to_cart.not_found",
    payload: {},
  });

  return { attempted: true, clicked: false, selector: null as string | null };
}

async function collectInternalCandidates(page: any, baseOrigin: string) {
  return await page.evaluate((origin: string) => {
    const anchors = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[];

    const out = {
      categoryPages: [] as string[],
      productPages: [] as string[],
      otherPages: [] as string[],
    };

    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      if (!href) continue;
      if (href.startsWith("#")) continue;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) continue;

      let abs = "";
      try {
        abs = new URL(href, origin).toString();
      } catch {
        continue;
      }

      if (!abs.startsWith(origin)) continue;
      if (abs.includes("/wp-admin") || abs.includes("/wp-login")) continue;

      const u = abs.toLowerCase();

      if (
        u.includes("/category/") ||
        u.includes("/categorie/") ||
        u.includes("/shop/") ||
        u.includes("/boutique/")
      ) {
        out.categoryPages.push(abs);
        continue;
      }

      if (u.includes("/product/") || u.includes("/produit/")) {
        out.productPages.push(abs);
        continue;
      }

      out.otherPages.push(abs);
    }

    return {
      categoryPages: Array.from(new Set(out.categoryPages)).slice(0, 3),
      productPages: Array.from(new Set(out.productPages)).slice(0, 10),
      otherPages: Array.from(new Set(out.otherPages)).slice(0, 20),
    };
  }, baseOrigin);
}

async function runRuntimeScan(url: string) {
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
      testedPages: [] as string[],
      confirmedPages: [] as string[],
    },
    add_to_cart: {
      attempted: false,
      clicked: false,
      ga4: false,
      datalayer: false,
      meta: false,
      testedPages: [] as string[],
      confirmedPages: [] as string[],
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
    v2: {
      categoryPagesTested: [] as string[],
      productPagesTested: [] as string[],
    },
     // ✅ AJOUT ICI
        trackingPayloads: {
          metaPayloads: [] as Array<{
            cmd: string;
            event: string;
            params: Record<string, any>;
            ts: number;
          }>,
          ga4Payloads: [] as Array<{
            event: string;
            params: Record<string, any>;
            ts: number;
          }>,
          metaNetworkEvents: [] as Array<Record<string, any>>,
          ga4NetworkEvents: [] as Array<Record<string, any>>,
        },
    report: {
      platform: "Unknown",
      pageType: "Unknown",
      confidence: "LOW" as Confidence,
      insights: [] as string[],
      checks: [] as ValidationCheck[],
    },
  };

  const ga4Ids = new Set<string>();
  const gtmIds = new Set<string>();
  const metaIds = new Set<string>();
  const dlEventNames = new Set<string>();
  const fbqEvents = new Set<string>();
  const gtagEvents = new Set<string>();

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

    if (reqUrl.includes("googletagmanager.com/gtm.js")) {
      const id = getParam(reqUrl, "id");
      if (id) gtmIds.add(id);
      timeline.push({ ts: now(), type: "request", name: "gtm.js", url: reqUrl, method });
    }

    if (reqUrl.includes("googletagmanager.com/gtag/js")) {
      const id = getParam(reqUrl, "id");
      if (id) ga4Ids.add(id);
      timeline.push({ ts: now(), type: "request", name: "gtag.js", url: reqUrl, method });
    }

    if (reqUrl.includes("google-analytics.com/g/collect") || reqUrl.includes("google-analytics.com/g/")) {
      signals.ga4Requests += 1;
      const tid = getParam(reqUrl, "tid");
      if (tid) ga4Ids.add(tid);

      const ev = getParam(reqUrl, "en");
      if (ev === "view_item") validation.view_item.ga4 = true;
      if (ev === "add_to_cart") validation.add_to_cart.ga4 = true;

      timeline.push({ ts: now(), type: "request", name: "ga4.collect", url: reqUrl, method });
    }

    if (reqUrl.includes("facebook.com/tr")) {
      signals.metaPixel = true;
      const pid = getParam(reqUrl, "id") || getParam(reqUrl, "pid");
      if (pid) metaIds.add(pid);

      const ev = getParam(reqUrl, "ev");
      if (ev) {
        fbqEvents.add(ev);
        if (ev === "ViewContent") validation.view_item.meta = true;
        if (ev === "AddToCart") validation.add_to_cart.meta = true;
      }

      timeline.push({ ts: now(), type: "request", name: "meta.tr", url: reqUrl, method });
    }

    if (hasAnyText(reqUrl, ["consent", "cmp", "onetrust", "cookiebot", "quantcast", "axeptio", "didomi"])) {
      signals.consentSeen = true;
    }
  });

await page.addInitScript(() => {
  // =========================================================
  // PixelLens Runtime Hooks
  // Goal:
  // - capture dataLayer pushes
  // - capture gtag events + params
  // - capture Meta fbq events + params
  // - survive delayed script loading (fbq/gtag may load later)
  // =========================================================

  // @ts-ignore
  window.__PIXELLENS__ = {
    dl: [],
    gtag: [],
    fbq: [],
    metaPayloads: [],
    ga4Payloads: [],
  };

  // =========================================================
  // 1) dataLayer hook
  // =========================================================
  // @ts-ignore
  window.dataLayer = window.dataLayer || [];
  // @ts-ignore
  const dl = window.dataLayer;
  const originalPush = dl.push.bind(dl);

  dl.push = function (...args: any[]) {
    try {
      // @ts-ignore
      window.__PIXELLENS__.dl.push(args);
    } catch {}

    return originalPush(...args);
  };

  // =========================================================
  // 2) gtag hook
  // Captures:
  // gtag("event", "view_item", {...})
  // =========================================================
  const attachGtagHook = () => {
    try {
      // @ts-ignore
      const currentGtag = window.gtag;
      // @ts-ignore
      if (typeof currentGtag !== "function" || currentGtag.__pixelLensWrapped) {
        return false;
      }

      const wrapped = function (...args: any[]) {
        try {
          // @ts-ignore
          window.__PIXELLENS__.gtag.push(args);

          const [cmd, eventName, params] = args;
          if (cmd === "event" && eventName) {
            // @ts-ignore
            window.__PIXELLENS__.ga4Payloads.push({
              event: String(eventName),
              params: params || {},
              ts: Date.now(),
            });
          }
        } catch {}

        return currentGtag.apply(this, args);
      };

      // @ts-ignore
      wrapped.__pixelLensWrapped = true;

      for (const k in currentGtag) {
        try {
          // @ts-ignore
          wrapped[k] = currentGtag[k];
        } catch {}
      }

      // @ts-ignore
      window.gtag = wrapped;
      return true;
    } catch {
      return false;
    }
  };

  attachGtagHook();

        // =========================================================
        // 3) Meta fbq hook
        // Captures:
        // fbq("track", "ViewContent", {...})
        // fbq("track", "AddToCart", {...})
        // fbq("track", "Purchase", {...})
        // =========================================================
        const attachFbqHook = () => {
          try {
            // @ts-ignore
            const currentFbq = window.fbq;
            // @ts-ignore
            if (typeof currentFbq !== "function" || currentFbq.__pixelLensWrapped) {
              return false;
            }

            const wrapped = function (...args: any[]) {
              try {
                // @ts-ignore
                window.__PIXELLENS__.fbq.push(args);

                const [cmd, eventName, params] = args;

                if ((cmd === "track" || cmd === "trackCustom") && eventName) {
                  // @ts-ignore
                  window.__PIXELLENS__.metaPayloads.push({
                    cmd: String(cmd),
                    event: String(eventName),
                    params: params || {},
                    ts: Date.now(),
                  });
                }
              } catch {}

              return currentFbq.apply(this, args);
            };

            // @ts-ignore
            wrapped.__pixelLensWrapped = true;

            for (const k in currentFbq) {
              try {
                // @ts-ignore
                wrapped[k] = currentFbq[k];
              } catch {}
            }

            // @ts-ignore
            window.fbq = wrapped;
            return true;
          } catch {
            return false;
          }
        };

        attachFbqHook();

        // =========================================================
        // 4) Retry hooks for delayed loading
        // Some sites load gtag/fbq after consent or after scripts finish
        // =========================================================
        let tries = 0;
        const interval = setInterval(() => {
          tries += 1;
          attachGtagHook();
          attachFbqHook();

          if (tries > 40) {
            clearInterval(interval);
          }
        }, 250);
      });

  try {
    // 1) Homepage
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    pagesVisited.push(page.url());
    raw.finalUrl = page.url();

    await page.waitForTimeout(800);
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(1200);

    const consent = await tryAutoConsent(page, timeline);
    if ((consent as any).clicked) signals.consentSeen = true;

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

    const baseOrigin = new URL(url).origin;
    const candidates = await collectInternalCandidates(page, baseOrigin);

    timeline.push({
      ts: now(),
      type: "note",
      name: "internal_pages_detected",
      payload: {
        category: candidates.categoryPages.length,
        products: candidates.productPages.length,
        other: candidates.otherPages.length,
      },
    });

    // 2) Optional category page
    if (candidates.categoryPages.length > 0) {
      const categoryUrl = candidates.categoryPages[0];

      try {
        await page.goto(categoryUrl, { waitUntil: "networkidle", timeout: 45000 });
        await page.waitForTimeout(1200);

        pagesVisited.push(page.url());
        raw.v2.categoryPagesTested.push(page.url());

        timeline.push({
          ts: now(),
          type: "note",
          name: "category_page_tested",
          payload: { url: page.url() },
        });
      } catch (e: any) {
        timeline.push({
          ts: now(),
          type: "note",
          name: "category_page_failed",
          payload: { url: categoryUrl, message: e?.message || String(e) },
        });
      }
    }

    // 3) Up to 3 product pages
    const productTargets =
      candidates.productPages.length > 0
        ? candidates.productPages.slice(0, 3)
        : candidates.otherPages.slice(0, 3);

    for (const productUrl of productTargets) {
      try {
        await page.goto(productUrl, { waitUntil: "networkidle", timeout: 45000 });
        await page.waitForTimeout(1500);

        const currentUrl = page.url();

        pagesVisited.push(currentUrl);
        raw.v2.productPagesTested.push(currentUrl);
        validation.view_item.testedPages.push(currentUrl);
        validation.add_to_cart.testedPages.push(currentUrl);

        timeline.push({
          ts: now(),
          type: "note",
          name: "product_page_tested",
          payload: { url: currentUrl },
        });

        const beforeViewGa4 = validation.view_item.ga4;
        const beforeViewDl = validation.view_item.datalayer;
        const beforeAtcGa4 = validation.add_to_cart.ga4;
        const beforeAtcDl = validation.add_to_cart.datalayer;

        // Give page some time to fire view_item
        await page.waitForTimeout(1500);

        if (validation.view_item.ga4 || validation.view_item.datalayer) {
          validation.view_item.attempted = true;
          validation.view_item.target = currentUrl;
          if (!validation.view_item.confirmedPages.includes(currentUrl)) {
            validation.view_item.confirmedPages.push(currentUrl);
          }
        } else if (!beforeViewGa4 && !beforeViewDl) {
          validation.view_item.attempted = true;
          validation.view_item.target = currentUrl;
        }

        const addToCart = await tryAddToCart(page, timeline);
        validation.add_to_cart.attempted = true;
        if (addToCart.clicked) {
          validation.add_to_cart.clicked = true;
        }

        await page.waitForTimeout(1500);

        if (validation.add_to_cart.ga4 || validation.add_to_cart.datalayer) {
          if (!validation.add_to_cart.confirmedPages.includes(currentUrl)) {
            validation.add_to_cart.confirmedPages.push(currentUrl);
          }
        } else if (!beforeAtcGa4 && !beforeAtcDl) {
          // keep attempted without confirmation
        }
      } catch (e: any) {
        timeline.push({
          ts: now(),
          type: "note",
          name: "product_page_failed",
          payload: { url: productUrl, message: e?.message || String(e) },
        });
      }
    }

      const hooks = await page.evaluate(() => {
        // @ts-ignore
        const p = (window as any).__PIXELLENS__ || {};
        return {
          dl: p.dl || [],
          gtag: p.gtag || [],
          fbq: p.fbq || [],
          metaPayloads: p.metaPayloads || [],
          ga4Payloads: p.ga4Payloads || [],
        };
      });

    for (const entry of hooks.dl as any[]) {
      const first = entry?.[0];

      if (first && typeof first === "object") {
        const ev = first.event ? String(first.event) : "dataLayer.push";
        dlEventNames.add(ev);

        timeline.push({
          ts: now(),
          type: "datalayer",
          name: ev,
          payload: safeJson(first),
        });

        const evLower = String(first.event || "").toLowerCase();

        if (evLower === "view_item") {
          validation.view_item.datalayer = true;
        }

        if (evLower === "add_to_cart") {
          validation.add_to_cart.datalayer = true;
        }
      } else {
        dlEventNames.add("dataLayer.push");
        timeline.push({
          ts: now(),
          type: "datalayer",
          name: "dataLayer.push",
          payload: safeJson(entry),
        });
      }
    }

    for (const args of hooks.gtag as any[]) {
      const t0 = String(args?.[0] || "");
      const t1 = String(args?.[1] || "");

      if (t0 === "event" && t1) {
        gtagEvents.add(t1);

        if (t1 === "view_item") {
          validation.view_item.ga4 = true;
        }

        if (t1 === "add_to_cart") {
          validation.add_to_cart.ga4 = true;
        }
      }
    }

    for (const args of hooks.fbq as any[]) {
      const t0 = String(args?.[0] || "");
      const t1 = String(args?.[1] || "");

      if ((t0 === "track" || t0 === "trackCustom") && t1) {
        fbqEvents.add(t1);

        if (t1 === "ViewContent") {
          validation.view_item.meta = true;
        }

        if (t1 === "AddToCart") {
          validation.add_to_cart.meta = true;
        }
      }
    }

    signals.gtmIds = Array.from(gtmIds);
    signals.ga4MeasurementIds = Array.from(ga4Ids);
    signals.metaPixelIds = Array.from(metaIds);
    signals.dataLayerEvents = Array.from(dlEventNames);
    signals.fbqEvents = Array.from(fbqEvents);
    signals.gtagEvents = Array.from(gtagEvents);

    raw.trackingPayloads.metaPayloads = Array.isArray(hooks.metaPayloads)
      ? hooks.metaPayloads.map((x: any) => safeJson(x))
      : [];

    raw.trackingPayloads.ga4Payloads = Array.isArray(hooks.ga4Payloads)
      ? hooks.ga4Payloads.map((x: any) => safeJson(x))
      : [];



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
        testedPages: validation.view_item.testedPages,
        confirmedPages: validation.view_item.confirmedPages,
        note:
          "V2 multi-page: view_item checked across product pages.",
      },
    });

    timeline.push({
      ts: now(),
      type: "validation",
      name: "add_to_cart",
      payload: {
        attempted: validation.add_to_cart.attempted,
        clicked: validation.add_to_cart.clicked,
        ga4: validation.add_to_cart.ga4,
        datalayer: validation.add_to_cart.datalayer,
        meta: validation.add_to_cart.meta,
        testedPages: validation.add_to_cart.testedPages,
        confirmedPages: validation.add_to_cart.confirmedPages,
        note:
          "V2 multi-page: add_to_cart checked across product pages.",
      },
    });

    raw.report.platform = inferPlatform(url, html, raw.requests);
    raw.report.pageType = inferPageType(
      validation.view_item.target || raw.finalUrl
    );

    return { pagesVisited, signals, validation, timeline, raw };
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

function buildRuntimeReport(result: Awaited<ReturnType<typeof runRuntimeScan>>) {
  const { signals, validation, raw } = result;

  // =========================================================
  // META MODULE — DATA SOURCES
  // Merge JS-captured payloads + network-captured payloads
  // =========================================================
  const jsMetaPayloads = Array.isArray(raw?.trackingPayloads?.metaPayloads)
    ? raw.trackingPayloads.metaPayloads
    : [];

  const networkMetaPayloads = Array.isArray(raw?.trackingPayloads?.metaNetworkEvents)
    ? raw.trackingPayloads.metaNetworkEvents
    : [];

  const metaPayloads = [...jsMetaPayloads, ...networkMetaPayloads];

  // =========================================================
  // META MODULE — ENGINES
  // =========================================================
  const metaAudit = buildMetaAudit(metaPayloads);
  const metaFunnel = buildMetaFunnel(metaAudit);
  const metaInsights = buildMetaInsights(metaAudit, metaFunnel);

  const validations: ValidationCheck[] = [];

  validations.push({
    check: "GTM",
    status: signals.gtmIds.length ? "CONFIRMED" : "NOT_CONFIRMED",
    confidence: signals.gtmIds.length ? "HIGH" : "LOW",
    evidence: signals.gtmIds.length
      ? `Container(s): ${signals.gtmIds.join(", ")}`
      : "No GTM script detected",
    action: signals.gtmIds.length ? "None" : "Install Google Tag Manager container on all pages",
  });

  validations.push({
    check: "GA4",
    status:
      signals.ga4Requests > 0 || signals.ga4MeasurementIds.length
        ? "CONFIRMED"
        : "NOT_CONFIRMED",
    confidence:
      signals.ga4Requests > 0 ? "HIGH" : signals.ga4MeasurementIds.length ? "MEDIUM" : "LOW",
    evidence: signals.ga4MeasurementIds.length
      ? `Measurement IDs: ${signals.ga4MeasurementIds.join(", ")}`
      : "No GA4 requests observed",
    action:
      signals.ga4Requests > 0 || signals.ga4MeasurementIds.length
        ? "None"
        : "Verify GA4 configuration and GTM triggers",
  });

  validations.push({
    check: "Meta Pixel",
    status: signals.metaPixel ? "CONFIRMED" : "NOT_CONFIRMED",
    confidence: signals.metaPixel ? "HIGH" : "LOW",
    evidence: signals.metaPixelIds.length
      ? `Pixel IDs: ${signals.metaPixelIds.join(", ")}`
      : "facebook.com/tr endpoint not detected",
    action: signals.metaPixel ? "None" : "Install Meta Pixel or verify tracking setup",
  });

  validations.push({
    check: "Consent",
    status: signals.consentSeen ? "CONFIRMED" : "UNVERIFIED",
    confidence: signals.consentSeen ? "HIGH" : "LOW",
    evidence: signals.consentSeen
      ? "CMP or consent signal detected"
      : "No CMP interaction detected",
    action: signals.consentSeen ? "Review consent behavior" : "Implement CMP and configure GTM consent mode",
  });

  const viewItemConfirmedCount = validation.view_item.confirmedPages.length;
  const viewItemTestedCount = validation.view_item.testedPages.length;

  validations.push({
    check: "view_item",
    status:
      viewItemConfirmedCount >= 2
        ? "CONFIRMED"
        : viewItemConfirmedCount === 1
        ? "PARTIAL"
        : validation.view_item.attempted
        ? "NOT_CONFIRMED"
        : "UNVERIFIED",
    confidence:
      viewItemConfirmedCount >= 2
        ? "HIGH"
        : viewItemConfirmedCount === 1
        ? "MEDIUM"
        : validation.view_item.attempted
        ? "LOW"
        : "LOW",
    evidence:
      viewItemTestedCount > 0
        ? `Confirmed on ${viewItemConfirmedCount}/${viewItemTestedCount} product page(s)`
        : "No product page tested",
    action:
      viewItemConfirmedCount >= 2
        ? "None"
        : "Review product page ecommerce mapping",
  });

  const addToCartConfirmedCount = validation.add_to_cart.confirmedPages.length;
  const addToCartTestedCount = validation.add_to_cart.testedPages.length;

  validations.push({
    check: "add_to_cart",
    status:
      addToCartConfirmedCount >= 2
        ? "CONFIRMED"
        : addToCartConfirmedCount === 1
        ? "PARTIAL"
        : validation.add_to_cart.attempted
        ? "NOT_CONFIRMED"
        : "UNVERIFIED",
    confidence:
      addToCartConfirmedCount >= 2
        ? "HIGH"
        : addToCartConfirmedCount === 1
        ? "MEDIUM"
        : validation.add_to_cart.attempted
        ? "LOW"
        : "LOW",
    evidence:
      addToCartTestedCount > 0
        ? `Confirmed on ${addToCartConfirmedCount}/${addToCartTestedCount} product page(s)`
        : "No add_to_cart interaction tested",
    action:
      addToCartConfirmedCount >= 2
        ? "None"
        : "Validate add_to_cart trigger and ecommerce payload",
  });

  validations.push({
    check: "Checkout",
    status: "UNVERIFIED",
    confidence: "LOW",
    evidence: "Checkout flow not simulated yet in V2 step 1",
    action: "Add checkout simulation in next step",
  });

  validations.push({
    check: "CAPI",
    status: "UNVERIFIED",
    confidence: "LOW",
    evidence: "Browser scan cannot fully verify server-side signals",
    action: "Validate Meta CAPI server-side outside browser-only scan",
  });

  let score = 0;
  if (signals.gtmIds.length) score += 20;
  if (signals.ga4Requests > 0 || signals.ga4MeasurementIds.length) score += 20;
  if (signals.metaPixel) score += 10;
  if (signals.consentSeen) score += 10;
  if (viewItemConfirmedCount >= 2) score += 20;
  else if (viewItemConfirmedCount === 1) score += 10;
  if (addToCartConfirmedCount >= 2) score += 20;
  else if (addToCartConfirmedCount === 1) score += 10;
  score = scoreClamp(score);

  const categoryScores = {
    gtm: signals.gtmIds.length ? 100 : 30,
    ga4: signals.ga4Requests > 0 || signals.ga4MeasurementIds.length ? 85 : 30,
    meta: signals.metaPixel ? 80 : 0,
    consent: signals.consentSeen ? 70 : 0,
    capi: 0,
  };

  const insights = [
    validations.find((v) => v.check === "GTM")?.status === "CONFIRMED" &&
    validations.find((v) => v.check === "GA4")?.status === "CONFIRMED"
      ? "GTM and GA4 are confirmed."
      : "Tracking stack is only partially confirmed.",
    `view_item confirmed on ${viewItemConfirmedCount}/${viewItemTestedCount} product page(s).`,
    `add_to_cart confirmed on ${addToCartConfirmedCount}/${addToCartTestedCount} product page(s).`,
    `PixelLens V2 tested ${raw.v2.productPagesTested.length} product page(s).`,
  ];

  const executiveSummary =
    `PixelLens Runtime Audit V2\n\n` +
    `Platform: ${raw.report.platform}\n` +
    `Page type: ${raw.report.pageType}\n` +
    `Category pages tested: ${raw.v2.categoryPagesTested.length}\n` +
    `Product pages tested: ${raw.v2.productPagesTested.length}\n\n` +
    `GTM: ${signals.gtmIds.length ? "confirmed" : "not confirmed"}\n` +
    `GA4: ${signals.ga4Requests > 0 || signals.ga4MeasurementIds.length ? "confirmed" : "not confirmed"}\n` +
    `Meta Pixel: ${signals.metaPixel ? "confirmed" : "not confirmed"}\n` +
    `Consent: ${signals.consentSeen ? "detected" : "unverified"}\n\n` +
    `view_item: confirmed on ${viewItemConfirmedCount}/${viewItemTestedCount} product page(s)\n` +
    `add_to_cart: confirmed on ${addToCartConfirmedCount}/${addToCartTestedCount} product page(s)\n`;

  raw.report.confidence = score >= 75 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW";
  raw.report.insights = insights;
  raw.report.checks = validations;

  // =========================================================
  // META MODULE — FINAL REPORT OUTPUT
  // Used by the Scan Detail UI
  // =========================================================
  (raw.report as any).metaInspector = {
    totalCapturedMetaPayloads: metaPayloads.length,
    events: metaAudit,
    funnel: metaFunnel,
    insights: metaInsights,
  };

  return {
    overallScore: score,
    categoryScores,
    validations,
    executiveSummary,
    raw,
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

    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "Invalid url. Must start with http(s)://" }, { status: 400 });
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