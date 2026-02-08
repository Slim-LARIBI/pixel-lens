import { chromium, type Browser, type Page } from "playwright";

type RuntimeEvent = {
  ts: number;
  type: "request" | "datalayer" | "gtag" | "fbq" | "consent";
  name: string;
  url?: string;
  method?: string;
  payload?: any;
};

type RuntimeResult = {
  pagesVisited: string[];
  signals: {
    ga4Requests: number;
    ga4MeasurementIds: string[];
    gtmIds: string[];
    metaPixel: boolean;
    metaPixelIds: string[];
    fbqEvents: string[];
    gtagEvents: string[];
    dataLayerEvents: string[];
    consentSeen: boolean;
  };
  timeline: RuntimeEvent[];
  raw: {
    requests: Array<{ url: string; method: string; postData?: string }>;
  };
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr)).filter(Boolean);
}

function extractGtmId(url: string) {
  const m = url.match(/id=(GTM-[A-Z0-9]+)/i);
  return m?.[1] ?? null;
}

function extractGa4MidFromUrl(url: string) {
  // GA4 can appear as tid=G-XXXX in collect requests (or sometimes in config scripts)
  const m = url.match(/[?&]tid=(G-[A-Z0-9]+)/i);
  return m?.[1] ?? null;
}

function looksLikeGa4Collect(url: string) {
  return (
    url.includes("google-analytics.com/g/collect") ||
    url.includes("www.google-analytics.com/g/collect") ||
    url.includes("www.google-analytics.com/collect") ||
    url.includes("google-analytics.com/collect")
  );
}

function looksLikeMetaPixel(url: string) {
  return (
    url.includes("www.facebook.com/tr/") ||
    url.includes("facebook.com/tr/") ||
    url.includes("connect.facebook.net") ||
    url.includes("graph.facebook.com")
  );
}

async function safeGoto(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  // un petit délai pour laisser partir les tags
  await page.waitForTimeout(2000);
}

async function tryClickAddToCart(page: Page) {
  const selectors = [
    'button:has-text("Add to cart")',
    'button:has-text("Add to Cart")',
    'button:has-text("Ajouter au panier")',
    'button:has-text("Ajouter au Panier")',
    'button[name*="add"]',
    '[data-testid*="add-to-cart"]',
    '[class*="add-to-cart"] button',
    'button:has-text("Buy")',
    'button:has-text("Acheter")',
  ];

  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      try {
        await el.click({ timeout: 3000 });
        await page.waitForTimeout(1500);
        return true;
      } catch {}
    }
  }
  return false;
}

async function tryGoCart(page: Page) {
  const selectors = [
    'a:has-text("Cart")',
    'a:has-text("Panier")',
    'a[href*="cart"]',
    'a[href*="panier"]',
    '[aria-label*="cart"]',
    '[aria-label*="panier"]',
  ];
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      try {
        await el.click({ timeout: 3000 });
        await page.waitForTimeout(2000);
        return true;
      } catch {}
    }
  }
  return false;
}

async function pickFirstProductLink(page: Page) {
  // heuristique : premier lien qui ressemble à une page produit
  const hrefs: string[] = await page.$$eval("a[href]", (as) =>
    as
      .map((a) => (a as HTMLAnchorElement).href)
      .filter(Boolean)
      .slice(0, 200)
  );

  const candidates = hrefs.filter((h) => {
    const u = h.toLowerCase();
    return (
      (u.includes("/product") ||
        u.includes("/produit") ||
        u.includes("sku=") ||
        u.includes("product_id=") ||
        u.match(/\/p\/|\/products\//)) &&
      !u.includes("mailto:") &&
      !u.includes("#")
    );
  });

  return candidates[0] ?? hrefs[0] ?? null;
}

export async function runPlaywrightScan(targetUrl: string): Promise<RuntimeResult> {
  let browser: Browser | null = null;

  const timeline: RuntimeEvent[] = [];
  const rawRequests: Array<{ url: string; method: string; postData?: string }> = [];

  const gtmIds: string[] = [];
  const ga4Mids: string[] = [];
  const metaPixelIds: string[] = [];

  const fbqEvents: string[] = [];
  const gtagEvents: string[] = [];
  const dataLayerEvents: string[] = [];

  let consentSeen = false;
  let metaPixel = false;
  let ga4Requests = 0;

  const pagesVisited: string[] = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    // ⚠️ Hook AVANT chargement pour capturer dataLayer/gtag/fbq
    await context.addInitScript(() => {
      (window as any).__pixellens = {
        dl: [],
        gtag: [],
        fbq: [],
        consent: [],
      };

      // dataLayer
      const w = window as any;
      const originalDL = w.dataLayer;
      if (!w.dataLayer) w.dataLayer = [];
      const dl = w.dataLayer;

      const origPush = dl.push?.bind(dl);
      dl.push = function (...args: any[]) {
        try {
          w.__pixellens.dl.push({ ts: Date.now(), args });
        } catch {}
        return origPush ? origPush(...args) : Array.prototype.push.apply(dl, args as any);
      };

      // gtag
      const origGtag = w.gtag;
      w.gtag = function (...args: any[]) {
        try {
          w.__pixellens.gtag.push({ ts: Date.now(), args });
        } catch {}
        if (typeof origGtag === "function") return origGtag(...args);
      };

      // fbq
      const origFbq = w.fbq;
      w.fbq = function (...args: any[]) {
        try {
          w.__pixellens.fbq.push({ ts: Date.now(), args });
        } catch {}
        if (typeof origFbq === "function") return origFbq(...args);
      };

      // consent (GCM v2 / older)
      const origGtag2 = w.gtag;
      w.gtag = function (...args: any[]) {
        try {
          const [cmd] = args;
          if (cmd === "consent") w.__pixellens.consent.push({ ts: Date.now(), args });
        } catch {}
        if (typeof origGtag2 === "function") return origGtag2(...args);
      };
    });

    const page = await context.newPage();

    // Capture réseau
    page.on("request", async (req) => {
      const url = req.url();
      const method = req.method();
      let postData: string | undefined;
      try {
        postData = req.postData() ?? undefined;
      } catch {}

      rawRequests.push({ url, method, postData });

      // GTM
      if (url.includes("googletagmanager.com/gtm.js")) {
        const id = extractGtmId(url);
        if (id) gtmIds.push(id);
        timeline.push({ ts: Date.now(), type: "request", name: "gtm.js", url, method });
      }

      // GA4
      if (looksLikeGa4Collect(url)) {
        ga4Requests += 1;
        const mid = extractGa4MidFromUrl(url);
        if (mid) ga4Mids.push(mid);
        timeline.push({ ts: Date.now(), type: "request", name: "ga4.collect", url, method });
      }

      // Meta
      if (looksLikeMetaPixel(url)) {
        metaPixel = true;
        // Pixel ID sometimes appears as ?id= in /tr
        const m = url.match(/[?&]id=(\d{6,})/);
        if (m?.[1]) metaPixelIds.push(m[1]);
        timeline.push({ ts: Date.now(), type: "request", name: "meta", url, method });
      }
    });

    // 1) Home
    await safeGoto(page, targetUrl);
    pagesVisited.push(page.url());

    // 2) Try product
    const product = await pickFirstProductLink(page);
    if (product) {
      await safeGoto(page, product);
      pagesVisited.push(page.url());
      await tryClickAddToCart(page);
    }

    // 3) Cart
    await tryGoCart(page);
    pagesVisited.push(page.url());

    // Récupérer les hooks runtime
    const runtime = await page.evaluate(() => {
      const w = window as any;
      return w.__pixellens || { dl: [], gtag: [], fbq: [], consent: [] };
    });

    // dataLayer events
    for (const e of runtime.dl || []) {
      const args = e.args || [];
      const first = args[0];
      const name =
        typeof first === "string"
          ? first
          : first?.event
          ? String(first.event)
          : "dataLayer.push";
      dataLayerEvents.push(name);
      timeline.push({ ts: e.ts || Date.now(), type: "datalayer", name, payload: first });
    }

    // gtag events
    for (const e of runtime.gtag || []) {
      const args = e.args || [];
      const cmd = args[0];
      const evt = args[1];
      const name =
        cmd === "event" ? `gtag.event:${evt ?? "unknown"}` : `gtag.${String(cmd ?? "call")}`;
      gtagEvents.push(name);
      timeline.push({ ts: e.ts || Date.now(), type: "gtag", name, payload: args });
    }

    // fbq events
    for (const e of runtime.fbq || []) {
      const args = e.args || [];
      const cmd = args[0];
      const evt = args[1];
      const name =
        cmd === "track" ? `fbq.track:${evt ?? "unknown"}` : `fbq.${String(cmd ?? "call")}`;
      fbqEvents.push(name);
      timeline.push({ ts: e.ts || Date.now(), type: "fbq", name, payload: args });
    }

    // consent
    if ((runtime.consent || []).length > 0) {
      consentSeen = true;
      for (const e of runtime.consent) {
        timeline.push({ ts: e.ts || Date.now(), type: "consent", name: "gtag.consent", payload: e.args });
      }
    }

    return {
      pagesVisited: uniq(pagesVisited),
      signals: {
        ga4Requests,
        ga4MeasurementIds: uniq(ga4Mids),
        gtmIds: uniq(gtmIds),
        metaPixel,
        metaPixelIds: uniq(metaPixelIds),
        fbqEvents: uniq(fbqEvents),
        gtagEvents: uniq(gtagEvents),
        dataLayerEvents: uniq(dataLayerEvents),
        consentSeen,
      },
      timeline,
      raw: { requests: rawRequests },
    };
  } finally {
    try {
      await browser?.close();
    } catch {}
  }
}