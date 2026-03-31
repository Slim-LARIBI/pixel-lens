import { NextResponse } from "next/server";
import { detectTechStack } from "@/lib/stack/tech-detector";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = String(body?.url || "").trim();

    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        { error: "Invalid url. Must start with http(s)://" },
        { status: 400 }
      );
    }

    const { chromium } = await import("playwright");

    const browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      viewport: { width: 1440, height: 900 },
    });

    const page = await context.newPage();

    const requests: Array<{ url: string; method?: string }> = [];
    const responses: Array<{ url: string; status?: number }> = [];

    page.on("request", (r: any) => {
      requests.push({
        url: String(r.url()),
        method: String(r.method()),
      });
    });

    page.on("response", (r: any) => {
      responses.push({
        url: String(r.url()),
        status: Number(r.status?.() ?? 0),
      });
    });

    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });

      await page.waitForTimeout(2500);

      // petit scroll pour charger des assets lazy / apps Shopify / widgets
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(1500);

      // on attend encore pour laisser les scripts tiers se charger
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(2000);

      const finalUrl = page.url();
      const html = await page.content();

      // scripts réellement présents dans le DOM
      const domSignals = await page.evaluate(() => {
        const scriptSrcs = Array.from(document.querySelectorAll("script[src]"))
          .map((el) => el.getAttribute("src") || "")
          .filter(Boolean);

        const linkHrefs = Array.from(document.querySelectorAll("link[href]"))
          .map((el) => el.getAttribute("href") || "")
          .filter(Boolean);

        const inlineText = Array.from(document.querySelectorAll("script"))
          .map((el) => el.textContent || "")
          .join("\n");

        const globals = {
          hasWindowShopify:
            typeof (window as any).Shopify !== "undefined",
          hasShopifyAnalytics:
            typeof (window as any).ShopifyAnalytics !== "undefined",
          hasGtag:
            typeof (window as any).gtag !== "undefined",
          hasFbq:
            typeof (window as any).fbq !== "undefined",
          hasDataLayer:
            typeof (window as any).dataLayer !== "undefined",
        };

        return {
          scriptSrcs,
          linkHrefs,
          inlineText,
          globals,
          userAgent: navigator.userAgent,
        };
      });

      const cookies = await context.cookies();

      // enrichissement des "requests" envoyées au detector
      const enrichedRequests: Array<{ url: string; method?: string }> = [
        ...requests,
        ...responses.map((r) => ({
          url: r.url,
          method: "RESPONSE",
        })),
        ...(domSignals.scriptSrcs || []).map((src: string) => ({
          url: src,
          method: "SCRIPT",
        })),
        ...(domSignals.linkHrefs || []).map((href: string) => ({
          url: href,
          method: "LINK",
        })),
        ...cookies.map((cookie) => ({
          url: `cookie:${cookie.name}=${cookie.value}`,
          method: "COOKIE",
        })),
        ...(domSignals.globals.hasWindowShopify ? [{ url: "runtime:window.Shopify", method: "RUNTIME" }] : []),
        ...(domSignals.globals.hasShopifyAnalytics ? [{ url: "runtime:ShopifyAnalytics", method: "RUNTIME" }] : []),
        ...(domSignals.globals.hasGtag ? [{ url: "runtime:gtag", method: "RUNTIME" }] : []),
        ...(domSignals.globals.hasFbq ? [{ url: "runtime:fbq", method: "RUNTIME" }] : []),
        ...(domSignals.globals.hasDataLayer ? [{ url: "runtime:dataLayer", method: "RUNTIME" }] : []),
      ];

      // enrichissement HTML avec inline JS + globals + cookies pour aider le detector
      const enrichedHtml = [
        html,
        "\n<!-- PIXELLENS INLINE SCRIPTS -->\n",
        domSignals.inlineText || "",
        "\n<!-- PIXELLENS GLOBALS -->\n",
        JSON.stringify(domSignals.globals, null, 2),
        "\n<!-- PIXELLENS COOKIES -->\n",
        cookies.map((c) => `${c.name}=${c.value}`).join("\n"),
      ].join("\n");

      const result = detectTechStack({
        url: finalUrl,
        html: enrichedHtml,
        requests: enrichedRequests,
      });

      return NextResponse.json(
        {
          url: finalUrl,
          result,
          debug: {
            requestCount: requests.length,
            responseCount: responses.length,
            scriptCount: domSignals.scriptSrcs?.length || 0,
            cookieCount: cookies.length,
            globals: domSignals.globals,
          },
        },
        { status: 200 }
      );
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  } catch (err: any) {
    console.error("POST /api/stack-scan error:", err);

    return NextResponse.json(
      { error: err?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}