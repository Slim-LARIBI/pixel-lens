import type {
  Confidence,
  TimelineItem,
  ValidationCheck,
  RuntimeScanResult,
} from "./runtime.types";

// =========================================================
// HELPERS — BASIC UTILS
// =========================================================

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

function hasAnyText(haystack: string, needles: string[]) {
  const s = (haystack || "").toLowerCase();
  return needles.some((n) => s.includes(n.toLowerCase()));
}

// =========================================================
// HELPERS — PLATFORM / PAGE TYPE
// =========================================================

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
  if (s.includes("/order-received") || s.includes("/thank-you")) return "Purchase";
  if (s.includes("/category") || s.includes("/categorie")) return "Category";

  return "Unknown";
}

// =========================================================
// HELPERS — CONSENT
// =========================================================

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

// =========================================================
// HELPERS — ADD TO CART
// =========================================================

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

// =========================================================
// HELPERS — BEGIN CHECKOUT
// =========================================================

// =========================================================
// HELPERS — BEGIN CHECKOUT
// =========================================================

async function tryGoToCheckout(page: any, timeline: any[]) {
  try {
    const selectors = [
      'a[href*="checkout"]',
      'a[href*="commande"]',
      'a[href*="commander"]',
      'button[name*="checkout"]',
      'button:has-text("Checkout")',
      'button:has-text("Commander")',
      'button:has-text("Passer la commande")',
      'button:has-text("Valider mon panier")',
      'a:has-text("Checkout")',
      'a:has-text("Commander")',
    ];

    for (const selector of selectors) {
      try {
        const el = page.locator(selector).first();

        if ((await el.count()) > 0 && (await el.isVisible({ timeout: 800 }))) {
          await el.click({ timeout: 2000 });

          timeline.push({
            ts: now(),
            type: "action",
            name: "begin_checkout_click",
            payload: { selector },
          });

          return { clicked: true, selector };
        }
      } catch {}
    }

    timeline.push({
      ts: now(),
      type: "note",
      name: "begin_checkout.not_found",
      payload: {},
    });

    return { clicked: false, selector: null };
  } catch (e: any) {
    timeline.push({
      ts: now(),
      type: "error",
      name: "begin_checkout_failed",
      payload: { message: e?.message || String(e) },
    });

    return { clicked: false, selector: null };
  }
}

// =========================================================
// INTERNAL PAGE DISCOVERY — STABLE VERSION
// =========================================================

async function collectInternalCandidates(page: any, baseOrigin: string) {
  return await page.evaluate((origin: string) => {
    const anchors = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[];

    const out = {
      categoryPages: [] as string[],
      productPages: [] as string[],
      cartPages: [] as string[],
      checkoutPages: [] as string[],
      purchasePages: [] as string[],
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

      if (u.includes("/cart") || u.includes("/panier")) {
        if (!out.cartPages.includes(abs)) out.cartPages.push(abs);
        continue;
      }

      if (u.includes("/checkout") || u.includes("/commande")) {
        if (!out.checkoutPages.includes(abs)) out.checkoutPages.push(abs);
        continue;
      }

      if (
        u.includes("/order-received") ||
        u.includes("/thank-you") ||
        u.includes("/confirmation") ||
        u.includes("/merci")
      ) {
        if (!out.purchasePages.includes(abs)) out.purchasePages.push(abs);
        continue;
      }

      if (
        u.includes("/category/") ||
        u.includes("/categorie/") ||
        u.includes("/product-category/") ||
        u.includes("/shop/") ||
        u.includes("/boutique/")
      ) {
        if (!out.categoryPages.includes(abs)) out.categoryPages.push(abs);
        continue;
      }

      if (
        u.includes("/product/") ||
        u.includes("/produit/") ||
        u.includes("?product=")
      ) {
        if (!out.productPages.includes(abs)) out.productPages.push(abs);
        continue;
      }

      out.otherPages.push(abs);
    }

    return {
      categoryPages: Array.from(new Set(out.categoryPages)).slice(0, 3),
      productPages: Array.from(new Set(out.productPages)).slice(0, 10),
      cartPages: Array.from(new Set(out.cartPages)).slice(0, 3),
      checkoutPages: Array.from(new Set(out.checkoutPages)).slice(0, 3),
      purchasePages: Array.from(new Set(out.purchasePages)).slice(0, 3),
      otherPages: Array.from(new Set(out.otherPages)).slice(0, 20),
    };
  }, baseOrigin);
}

// =========================================================
// PRODUCT LINKS FROM CURRENT PAGE
// =========================================================

async function collectProductLinksFromCurrentPage(page: any, baseOrigin: string) {
  return await page.evaluate((origin: string) => {
    const selectors = [
      "li.product a[href]",
      ".product a[href]",
      ".products a[href]",
      ".woocommerce-loop-product__link",
      "a.woocommerce-LoopProduct-link",
      "[class*='product'] a[href]",
      "[data-product-id] a[href]",
    ];

    const urls: string[] = [];

    const pushUrl = (href: string) => {
      try {
        const abs = new URL(href, origin).toString();
        if (!abs.startsWith(origin)) return;
        if (abs.includes("/cart") || abs.includes("/checkout")) return;
        if (abs.includes("/wp-admin") || abs.includes("/wp-login")) return;
        if (!urls.includes(abs)) urls.push(abs);
      } catch {}
    };

    for (const selector of selectors) {
      const els = Array.from(document.querySelectorAll(selector)) as HTMLAnchorElement[];

      for (const el of els) {
        const href = el.getAttribute("href") || "";
        if (!href) continue;
        pushUrl(href);
      }
    }

    return urls.slice(0, 12);
  }, baseOrigin);
}

// =========================================================
// HELPERS — GA4 EVENT RECOGNITION
// =========================================================

function isCoreGA4EventName(ev: string) {
  return ["view_item", "add_to_cart", "begin_checkout", "purchase"].includes(
    String(ev || "").toLowerCase()
  );
}

function normalizeGA4ParamsFromPayload(eventName: string, payload: Record<string, any>) {
  const clone = { ...(payload || {}) };
  delete clone.event;

  const ecommerce =
    clone?.ecommerce && typeof clone.ecommerce === "object" ? clone.ecommerce : null;

  let normalized: Record<string, any> = { ...clone };

  if (ecommerce) {
    normalized = {
      ...normalized,
      ...ecommerce,
    };
  }

  if (!normalized.items && Array.isArray(ecommerce?.items)) {
    normalized.items = ecommerce.items;
  }

  if (!normalized.items && Array.isArray(clone?.products)) {
    normalized.items = clone.products;
  }

  if (!normalized.items && Array.isArray(ecommerce?.products)) {
    normalized.items = ecommerce.products;
  }

  if (!normalized.currency && ecommerce?.currency) {
    normalized.currency = ecommerce.currency;
  }

  if (!normalized.currency && ecommerce?.currencyCode) {
    normalized.currency = ecommerce.currencyCode;
  }

  if (!normalized.value && ecommerce?.value !== undefined) {
    normalized.value = ecommerce.value;
  }

  if (!normalized.value && ecommerce?.revenue !== undefined) {
    normalized.value = ecommerce.revenue;
  }

  if (!normalized.transaction_id && ecommerce?.transaction_id) {
    normalized.transaction_id = ecommerce.transaction_id;
  }

  if (!normalized.transaction_id && ecommerce?.transactionId) {
    normalized.transaction_id = ecommerce.transactionId;
  }

  if (!normalized.transaction_id && clone?.transaction_id) {
    normalized.transaction_id = clone.transaction_id;
  }

  if (!normalized.transaction_id && clone?.transactionId) {
    normalized.transaction_id = clone.transactionId;
  }

  return normalized;
}

function extractGA4RecordsFromDataLayerEntries(entries: any[]) {
  const out: Array<{
    event: string;
    params: Record<string, any>;
    ts: number;
    source: string;
  }> = [];

  for (const entry of entries || []) {
    const payload = entry?.payload ?? entry;
    if (!payload || typeof payload !== "object") continue;

    const ev = String(payload?.event || "").toLowerCase();
    if (!isCoreGA4EventName(ev)) continue;

    out.push({
      event: ev,
      params: normalizeGA4ParamsFromPayload(ev, payload),
      ts: entry?.ts || Date.now(),
      source: entry?.source || "datalayer-snapshot",
    });
  }

  return out;
}

// =========================================================
// MAIN SCAN
// =========================================================

export async function runRuntimeScan(url: string): Promise<RuntimeScanResult> {
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

    googleAdsDetected: false,
    googleAdsIds: [] as string[],
    googleAdsConversionLabels: [] as string[],
    googleAdsConversionEvents: [] as string[],
    googleAdsRemarketingDetected: false,
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
    begin_checkout: {
      attempted: false,
      ga4: false,
      datalayer: false,
      meta: false,
      testedPages: [] as string[],
      confirmedPages: [] as string[],
    },
    purchase: {
      attempted: false,
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
      hasGoogleAdsInHtml: false,
    },
    v2: {
      categoryPagesTested: [] as string[],
      productPagesTested: [] as string[],
      cartPagesTested: [] as string[],
      checkoutPagesTested: [] as string[],
      purchasePagesTested: [] as string[],
    },
    trackingPayloads: {
      metaPayloads: [] as Array<any>,
      ga4Payloads: [] as Array<any>,
      metaNetworkEvents: [] as Array<Record<string, any>>,
      ga4NetworkEvents: [] as Array<Record<string, any>>,
      googleAdsNetworkEvents: [] as Array<Record<string, any>>,
      universalInterceptor: {
        dataLayer: [] as Array<any>,
        gtag: [] as Array<any>,
        fbq: [] as Array<any>,
        fetch: [] as Array<any>,
        xhr: [] as Array<any>,
        beacon: [] as Array<any>,
      },
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

  const googleAdsIds = new Set<string>();
  const googleAdsConversionLabels = new Set<string>();
  const googleAdsConversionEvents = new Set<string>();

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  // =======================================================
  // REQUEST LISTENER
  // =======================================================
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
      if (id) {
        ga4Ids.add(id);

        if (id.startsWith("AW-")) {
          signals.googleAdsDetected = true;
          googleAdsIds.add(id);
        }
      }
      timeline.push({ ts: now(), type: "request", name: "gtag.js", url: reqUrl, method });
    }

    if (
      reqUrl.includes("google-analytics.com/g/collect") ||
      reqUrl.includes("google-analytics.com/g/")
    ) {
      signals.ga4Requests += 1;
      const tid = getParam(reqUrl, "tid");
      if (tid) ga4Ids.add(tid);

      const ev = getParam(reqUrl, "en");
      const params = Object.fromEntries(new URL(reqUrl).searchParams.entries());

      raw.trackingPayloads.ga4NetworkEvents.push({
        event: ev,
        params,
        ts: Date.now(),
        source: "ga4-network-request",
      });

      if (ev === "view_item") validation.view_item.ga4 = true;
      if (ev === "add_to_cart") validation.add_to_cart.ga4 = true;
      if (ev === "begin_checkout") validation.begin_checkout.ga4 = true;
      if (ev === "purchase") validation.purchase.ga4 = true;

      timeline.push({
        ts: now(),
        type: "request",
        name: "ga4.collect",
        url: reqUrl,
        method,
      });
    }

        if (
      reqUrl.includes("googleadservices.com/pagead/conversion/") ||
      reqUrl.includes("googleads.g.doubleclick.net/pagead/viewthroughconversion/") ||
      reqUrl.includes("googleads.g.doubleclick.net/pagead/conversion/") ||
      reqUrl.includes("doubleclick.net/pagead/conversion/")
    ) {
      signals.googleAdsDetected = true;

      const awIdFromPath =
        reqUrl.match(/conversion\/(AW-[0-9]+)\//i)?.[1] ||
        reqUrl.match(/conversion\/([0-9]+)\//i)?.[1] ||
        reqUrl.match(/viewthroughconversion\/([0-9]+)\//i)?.[1];

      if (awIdFromPath) {
        const normalizedId = String(awIdFromPath).startsWith("AW-")
          ? String(awIdFromPath)
          : `AW-${String(awIdFromPath)}`;
        googleAdsIds.add(normalizedId);
      }

      const label =
        getParam(reqUrl, "label") ||
        getParam(reqUrl, "cv") ||
        getParam(reqUrl, "fmt");

      if (label) {
        googleAdsConversionLabels.add(label);
      }

      const value = getParam(reqUrl, "value");
      const currency =
        getParam(reqUrl, "currency_code") ||
        getParam(reqUrl, "currency");

      const inferredEvent = reqUrl.includes("viewthroughconversion")
        ? "remarketing"
        : value || currency
        ? "purchase"
        : "conversion";

      if (inferredEvent) {
        googleAdsConversionEvents.add(inferredEvent);
      }

      raw.trackingPayloads.googleAdsNetworkEvents.push({
        url: reqUrl,
        awId: awIdFromPath
          ? String(awIdFromPath).startsWith("AW-")
            ? String(awIdFromPath)
            : `AW-${String(awIdFromPath)}`
          : null,
        label,
        value,
        currency,
        event: inferredEvent,
      });

      timeline.push({
        ts: now(),
        type: "request",
        name: reqUrl.includes("viewthroughconversion")
          ? "google_ads.remarketing"
          : "google_ads.conversion",
        url: reqUrl,
        method,
      });
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
        if (ev === "InitiateCheckout") validation.begin_checkout.meta = true;
        if (ev === "Purchase") validation.purchase.meta = true;
      }

      try {
        const urlObj = new URL(reqUrl);

        raw.trackingPayloads.metaNetworkEvents.push({
          event: urlObj.searchParams.get("ev"),
          currency: urlObj.searchParams.get("cd[currency]"),
          value: urlObj.searchParams.get("cd[value]"),
          content_ids: urlObj.searchParams.get("cd[content_ids]"),
          content_type: urlObj.searchParams.get("cd[content_type]"),
          raw: reqUrl,
        });
      } catch {}

      timeline.push({
        ts: now(),
        type: "request",
        name: "meta.tr",
        url: reqUrl,
        method,
      });
    }

    if (
      hasAnyText(reqUrl, [
        "consent",
        "cmp",
        "onetrust",
        "cookiebot",
        "quantcast",
        "axeptio",
        "didomi",
      ])
    ) {
      signals.consentSeen = true;
    }
  });

  // =======================================================
  // UNIVERSAL INTERCEPTOR
  // =======================================================
  await page.addInitScript(() => {
    // @ts-ignore
    window.__PIXELLENS__ = {
      dataLayerPushes: [],
      dataLayerSnapshot: [],
      gtag: [],
      fbq: [],
      fetch: [],
      xhr: [],
      beacon: [],
    };

    // @ts-ignore
    window.dataLayer = window.dataLayer || [];
    // @ts-ignore
    const dl = window.dataLayer;
    const originalPush = dl.push.bind(dl);

    dl.push = function (...args: any[]) {
      try {
        for (const arg of args) {
          // @ts-ignore
          window.__PIXELLENS__.dataLayerPushes.push({
            ts: Date.now(),
            payload: arg,
            source: "push",
          });
        }
      } catch {}

      return originalPush(...args);
    };

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
            window.__PIXELLENS__.gtag.push({
              ts: Date.now(),
              args,
            });
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
            window.__PIXELLENS__.fbq.push({
              ts: Date.now(),
              args,
            });
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

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      try {
        // @ts-ignore
        window.__PIXELLENS__.fetch.push({
          ts: Date.now(),
          args,
        });
      } catch {}

      // @ts-ignore
      return originalFetch.apply(this, args);
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method: string, url: string, ...rest: any[]) {
      // @ts-ignore
      this.__pixelLens = { method, url };
      // @ts-ignore
      return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (...args: any[]) {
      try {
        // @ts-ignore
        const meta = this.__pixelLens || {};
        // @ts-ignore
        window.__PIXELLENS__.xhr.push({
          ts: Date.now(),
          method: meta.method,
          url: meta.url,
        });
      } catch {}

      // @ts-ignore
      return originalSend.apply(this, args);
    };

    const originalBeacon = navigator.sendBeacon?.bind(navigator);
    if (originalBeacon) {
      navigator.sendBeacon = function (...args: any[]) {
        try {
          // @ts-ignore
          window.__PIXELLENS__.beacon.push({
            ts: Date.now(),
            args,
          });
        } catch {}

        return originalBeacon(...args);
      };
    }

    attachGtagHook();
    attachFbqHook();

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
    // =====================================================
    // HOMEPAGE
    // =====================================================
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
    const htmlGoogleAds = uniq(html.match(/AW-[0-9]+/g) || []);

    htmlGtm.forEach((x) => gtmIds.add(x));
    htmlGa4.forEach((x) => ga4Ids.add(x));
    htmlGoogleAds.forEach((x) => {
      signals.googleAdsDetected = true;
      googleAdsIds.add(x);
    });

    const mpMatch = html.match(/\bfbq\(.{0,80}init.{0,80}['"](\d{8,})['"]/i);
    if (mpMatch?.[1]) {
      signals.metaPixel = true;
      metaIds.add(mpMatch[1]);
    }

    raw.htmlSnippets.hasGtmInHtml = htmlGtm.length > 0;
    raw.htmlSnippets.hasGa4InHtml = htmlGa4.length > 0;
    raw.htmlSnippets.hasMetaInHtml = !!mpMatch?.[1];
    raw.htmlSnippets.hasGoogleAdsInHtml = htmlGoogleAds.length > 0;

    const baseOrigin = new URL(url).origin;
    const candidates = await collectInternalCandidates(page, baseOrigin);

    timeline.push({
      ts: now(),
      type: "note",
      name: "internal_pages_detected",
      payload: {
        category: candidates.categoryPages.length,
        products: candidates.productPages.length,
        cart: candidates.cartPages.length,
        checkout: candidates.checkoutPages.length,
        purchase: candidates.purchasePages.length,
        other: candidates.otherPages.length,
      },
    });

    // =====================================================
    // CATEGORY PAGE
    // =====================================================
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

    // =====================================================
    // PRODUCT PAGES (STRICT MODE - NO FALLBACK)
    // =====================================================
    const productTargets = (candidates.productPages || []).slice(0, 3);

    if (productTargets.length === 0) {
      timeline.push({
        ts: now(),
        type: "warning" as any,
        name: "no_product_pages_found",
        payload: {},
      });
    }

    for (const productUrl of productTargets) {
      try {
        await page.goto(productUrl, { waitUntil: "networkidle", timeout: 45000 });
        await page.waitForTimeout(2000);

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

        validation.view_item.attempted = true;
        validation.view_item.target = currentUrl;

        const addToCart = await tryAddToCart(page, timeline);

        validation.add_to_cart.attempted = true;

        if (addToCart?.clicked) {
          validation.add_to_cart.clicked = true;
        }

        await page.waitForTimeout(2000);
      } catch (e: any) {
        timeline.push({
          ts: now(),
          type: "note",
          name: "product_page_failed",
          payload: { url: productUrl, message: e?.message || String(e) },
        });
      }
    }

// =====================================================
// BEGIN CHECKOUT (from cart / checkout navigation)
// Goal:
// - click checkout CTA if available
// - detect begin_checkout either by event OR by real checkout URL navigation
// =====================================================

const checkoutAttempt = await tryGoToCheckout(page, timeline);

validation.begin_checkout.attempted = true;

await page.waitForTimeout(2500);

const currentAfterCheckoutClick = page.url().toLowerCase();

const reachedCheckoutByUrl =
  currentAfterCheckoutClick.includes("/checkout") ||
  currentAfterCheckoutClick.includes("/commande") ||
  currentAfterCheckoutClick.includes("order-pay") ||
  currentAfterCheckoutClick.includes("wc-ajax=checkout");

// si on a cliqué et qu'on a bien atteint une vraie URL checkout,
// on considère begin_checkout comme détecté côté runtime
if (checkoutAttempt?.clicked && reachedCheckoutByUrl) {
  validation.begin_checkout.datalayer = true;

  if (!validation.begin_checkout.testedPages.includes(page.url())) {
    validation.begin_checkout.testedPages.push(page.url());
  }

  if (!validation.begin_checkout.confirmedPages.includes(page.url())) {
    validation.begin_checkout.confirmedPages.push(page.url());
  }

  timeline.push({
    ts: now(),
    type: "note",
    name: "begin_checkout.detected_by_url",
    payload: {
      url: page.url(),
      detection: "checkout-url-navigation",
    },
  });
}

    // =====================================================
    // CHECKOUT PAGES (discover / inspect only)
    // =====================================================
    for (const checkoutUrl of candidates.checkoutPages.slice(0, 2)) {
      try {
        await page.goto(checkoutUrl, { waitUntil: "networkidle", timeout: 45000 });
        await page.waitForTimeout(1500);

        const currentUrl = page.url();
        pagesVisited.push(currentUrl);
        raw.v2.checkoutPagesTested.push(currentUrl);
        validation.begin_checkout.testedPages.push(currentUrl);
        validation.begin_checkout.attempted = true;

        timeline.push({
          ts: now(),
          type: "note",
          name: "checkout_page_tested",
          payload: { url: currentUrl },
        });
      } catch (e: any) {
        timeline.push({
          ts: now(),
          type: "note",
          name: "checkout_page_failed",
          payload: { url: checkoutUrl, message: e?.message || String(e) },
        });
      }
    }

    // =====================================================
    // PURCHASE PAGES (inspect only if discoverable)
    // =====================================================
    for (const purchaseUrl of candidates.purchasePages.slice(0, 2)) {
      try {
        await page.goto(purchaseUrl, { waitUntil: "networkidle", timeout: 45000 });
        await page.waitForTimeout(1500);

        const currentUrl = page.url();
        pagesVisited.push(currentUrl);
        raw.v2.purchasePagesTested.push(currentUrl);
        validation.purchase.testedPages.push(currentUrl);
        validation.purchase.attempted = true;

        timeline.push({
          ts: now(),
          type: "note",
          name: "purchase_page_tested",
          payload: { url: currentUrl },
        });
      } catch (e: any) {
        timeline.push({
          ts: now(),
          type: "note",
          name: "purchase_page_failed",
          payload: { url: purchaseUrl, message: e?.message || String(e) },
        });
      }
    }

    // =====================================================
    // FINAL SNAPSHOT FROM BROWSER
    // =====================================================
    const hooks = await page.evaluate(() => {
      // @ts-ignore
      const p = (window as any).__PIXELLENS__ || {};

      // @ts-ignore
      const currentDataLayer = Array.isArray(window.dataLayer) ? window.dataLayer : [];

      const snapshot = currentDataLayer.map((item: any) => ({
        ts: Date.now(),
        payload: item,
        source: "snapshot",
      }));

      return {
        dataLayerPushes: p.dataLayerPushes || [],
        dataLayerSnapshot: snapshot || [],
        gtag: p.gtag || [],
        fbq: p.fbq || [],
        fetch: p.fetch || [],
        xhr: p.xhr || [],
        beacon: p.beacon || [],
      };
    });

    raw.trackingPayloads.universalInterceptor.dataLayer = [
      ...(Array.isArray(hooks.dataLayerPushes) ? hooks.dataLayerPushes : []),
      ...(Array.isArray(hooks.dataLayerSnapshot) ? hooks.dataLayerSnapshot : []),
    ].map((x: any) => safeJson(x));

    raw.trackingPayloads.universalInterceptor.gtag = Array.isArray(hooks.gtag)
      ? hooks.gtag.map((x: any) => safeJson(x))
      : [];

    raw.trackingPayloads.universalInterceptor.fbq = Array.isArray(hooks.fbq)
      ? hooks.fbq.map((x: any) => safeJson(x))
      : [];

    raw.trackingPayloads.universalInterceptor.fetch = Array.isArray(hooks.fetch)
      ? hooks.fetch.map((x: any) => safeJson(x))
      : [];

    raw.trackingPayloads.universalInterceptor.xhr = Array.isArray(hooks.xhr)
      ? hooks.xhr.map((x: any) => safeJson(x))
      : [];

    raw.trackingPayloads.universalInterceptor.beacon = Array.isArray(hooks.beacon)
      ? hooks.beacon.map((x: any) => safeJson(x))
      : [];

    const combinedDataLayerEntries = [
      ...(Array.isArray(hooks.dataLayerPushes) ? hooks.dataLayerPushes : []),
      ...(Array.isArray(hooks.dataLayerSnapshot) ? hooks.dataLayerSnapshot : []),
    ];

    for (const entry of combinedDataLayerEntries as any[]) {
      const payload = entry?.payload;
      const first = payload;

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

        if (evLower === "begin_checkout") {
          validation.begin_checkout.datalayer = true;
        }

        if (evLower === "purchase") {
          validation.purchase.datalayer = true;
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

    const ga4PayloadsFromDataLayer = extractGA4RecordsFromDataLayerEntries(
      combinedDataLayerEntries
    );

    raw.trackingPayloads.ga4Payloads = ga4PayloadsFromDataLayer.map((x) => safeJson(x));

    for (const record of ga4PayloadsFromDataLayer) {
      if (record.event === "view_item") {
        validation.view_item.datalayer = true;
      }
      if (record.event === "add_to_cart") {
        validation.add_to_cart.datalayer = true;
      }
      if (record.event === "begin_checkout") {
        validation.begin_checkout.datalayer = true;
      }
      if (record.event === "purchase") {
        validation.purchase.datalayer = true;
      }
    }

    for (const pageUrl of validation.view_item.testedPages) {
      if (
        (validation.view_item.ga4 || validation.view_item.datalayer) &&
        !validation.view_item.confirmedPages.includes(pageUrl)
      ) {
        validation.view_item.confirmedPages.push(pageUrl);
      }
    }

    for (const pageUrl of validation.add_to_cart.testedPages) {
      if (
        (validation.add_to_cart.ga4 || validation.add_to_cart.datalayer) &&
        !validation.add_to_cart.confirmedPages.includes(pageUrl)
      ) {
        validation.add_to_cart.confirmedPages.push(pageUrl);
      }
    }

    for (const pageUrl of validation.begin_checkout.testedPages) {
      if (
        (validation.begin_checkout.ga4 || validation.begin_checkout.datalayer) &&
        !validation.begin_checkout.confirmedPages.includes(pageUrl)
      ) {
        validation.begin_checkout.confirmedPages.push(pageUrl);
      }
    }

    for (const pageUrl of validation.purchase.testedPages) {
      if (
        (validation.purchase.ga4 || validation.purchase.datalayer) &&
        !validation.purchase.confirmedPages.includes(pageUrl)
      ) {
        validation.purchase.confirmedPages.push(pageUrl);
      }
    }

    for (const entry of hooks.gtag as any[]) {
      const args = Array.isArray(entry?.args) ? entry.args : [];
      const t0 = String(args?.[0] || "");
      const t1 = String(args?.[1] || "");
      const params = args?.[2] && typeof args?.[2] === "object" ? args[2] : {};

      // ---------------------------------------------------
      // GA4 standard events
      // ---------------------------------------------------
      if (t0 === "event" && t1) {
        gtagEvents.add(t1);

        if (t1 === "view_item") validation.view_item.ga4 = true;
        if (t1 === "add_to_cart") validation.add_to_cart.ga4 = true;
        if (t1 === "begin_checkout") validation.begin_checkout.ga4 = true;
        if (t1 === "purchase") validation.purchase.ga4 = true;
      }

      // ---------------------------------------------------
      // Google Ads config
      // Example:
      // gtag("config", "AW-123456789")
      // ---------------------------------------------------
      if (t0 === "config" && t1 && t1.startsWith("AW-")) {
        signals.googleAdsDetected = true;
        googleAdsIds.add(t1);
      }

      // ---------------------------------------------------
      // Google Ads send_to mapping
      // Examples:
      // gtag("event", "conversion", { send_to: "AW-123/abc" })
      // gtag("event", "purchase", { send_to: "AW-123/abc" })
      // ---------------------------------------------------
      const sendToRaw = params?.send_to;
      const sendToList = Array.isArray(sendToRaw)
        ? sendToRaw
        : typeof sendToRaw === "string"
        ? [sendToRaw]
        : [];

      for (const sendTo of sendToList) {
        const value = String(sendTo || "");
        const match = value.match(/^(AW-[0-9]+)\/(.+)$/i);

        if (match) {
          const awId = match[1];
          const label = match[2];

          signals.googleAdsDetected = true;
          googleAdsIds.add(awId);

          if (label) {
            googleAdsConversionLabels.add(label);
          }

          if (t1 === "conversion") {
            googleAdsConversionEvents.add("conversion");
          }

          if (
            ["page_view", "view_item", "add_to_cart", "begin_checkout", "purchase"].includes(t1)
          ) {
            googleAdsConversionEvents.add(t1);
          }

          raw.trackingPayloads.googleAdsNetworkEvents.push({
            url: `gtag:${t1}`,
            awId,
            label,
            event: t1,
            value: params?.value ?? null,
            currency: params?.currency ?? null,
            source: "gtag-runtime",
          });
        }
      }
    }

    for (const entry of hooks.fbq as any[]) {
      const args = Array.isArray(entry?.args) ? entry.args : [];
      const t0 = String(args?.[0] || "");
      const t1 = String(args?.[1] || "");

      if ((t0 === "track" || t0 === "trackCustom") && t1) {
        fbqEvents.add(t1);

        if (t1 === "ViewContent") validation.view_item.meta = true;
        if (t1 === "AddToCart") validation.add_to_cart.meta = true;
        if (t1 === "InitiateCheckout") validation.begin_checkout.meta = true;
        if (t1 === "Purchase") validation.purchase.meta = true;
      }
    }

    signals.gtmIds = Array.from(gtmIds);
    signals.ga4MeasurementIds = Array.from(ga4Ids);
    signals.metaPixelIds = Array.from(metaIds);
    signals.dataLayerEvents = Array.from(dlEventNames);
    signals.fbqEvents = Array.from(fbqEvents);
    signals.gtagEvents = Array.from(gtagEvents);

    signals.googleAdsIds = Array.from(googleAdsIds);
    signals.googleAdsConversionLabels = Array.from(googleAdsConversionLabels);
    signals.googleAdsConversionEvents = Array.from(googleAdsConversionEvents);

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
        note: "Runtime validation for view_item.",
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
        note: "Runtime validation for add_to_cart.",
      },
    });

    timeline.push({
      ts: now(),
      type: "validation",
      name: "begin_checkout",
      payload: {
        attempted: validation.begin_checkout.attempted,
        ga4: validation.begin_checkout.ga4,
        datalayer: validation.begin_checkout.datalayer,
        meta: validation.begin_checkout.meta,
        testedPages: validation.begin_checkout.testedPages,
        confirmedPages: validation.begin_checkout.confirmedPages,
        note: "Runtime validation for begin_checkout.",
      },
    });

    timeline.push({
      ts: now(),
      type: "validation",
      name: "purchase",
      payload: {
        attempted: validation.purchase.attempted,
        ga4: validation.purchase.ga4,
        datalayer: validation.purchase.datalayer,
        meta: validation.purchase.meta,
        testedPages: validation.purchase.testedPages,
        confirmedPages: validation.purchase.confirmedPages,
        note: "Runtime validation for purchase.",
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