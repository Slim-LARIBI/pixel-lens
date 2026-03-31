// app/api/scans/runtime/core/runtime.interceptor.ts

export async function installUniversalTrackingInterceptor(page: any) {
  await page.addInitScript(() => {
    // ------------------------------------------------------
    // Global storage
    // ------------------------------------------------------
    // @ts-ignore
    window.__PIXELLENS_V2__ = {
      startedAt: Date.now(),
      dataLayer: [],
      gtag: [],
      fbq: [],
      fetch: [],
      xhr: [],
      beacon: [],
      networkSignals: {
        ga4: [],
        meta: [],
        googleAds: [],
        other: [],
      },
    };

    // ------------------------------------------------------
    // Helpers
    // ------------------------------------------------------
    const safeClone = (value: any) => {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch {
        try {
          return String(value);
        } catch {
          return null;
        }
      }
    };

    const pushStore = (bucket: string, payload: any) => {
      try {
        // @ts-ignore
        if (!window.__PIXELLENS_V2__[bucket]) {
          // @ts-ignore
          window.__PIXELLENS_V2__[bucket] = [];
        }
        // @ts-ignore
        window.__PIXELLENS_V2__[bucket].push(payload);
      } catch {}
    };

    const classifyNetworkUrl = (url: string) => {
      const u = String(url || "");

      if (
        u.includes("google-analytics.com/g/collect") ||
        u.includes("google-analytics.com/mp/collect") ||
        u.includes("googletagmanager.com/gtag/js")
      ) {
        return "ga4";
      }

      if (
        u.includes("facebook.com/tr") ||
        u.includes("connect.facebook.net")
      ) {
        return "meta";
      }

      if (
        u.includes("googleadservices.com/pagead/conversion") ||
        u.includes("googleads.g.doubleclick.net/pagead/conversion") ||
        u.includes("googleads.g.doubleclick.net/pagead/viewthroughconversion") ||
        u.includes("doubleclick.net/pagead/viewthroughconversion")
      ) {
        return "googleAds";
      }

      return "other";
    };

    const pushNetworkSignal = (kind: "fetch" | "xhr" | "beacon", url: string, body?: any) => {
      const item = {
        kind,
        url: String(url || ""),
        body: safeClone(body),
        ts: Date.now(),
      };

      const bucket = classifyNetworkUrl(item.url);

      try {
        // @ts-ignore
        window.__PIXELLENS_V2__.networkSignals[bucket].push(item);
      } catch {}

      pushStore(kind, item);
    };

    // ------------------------------------------------------
    // 1) dataLayer interception
    // ------------------------------------------------------
    // @ts-ignore
    window.dataLayer = window.dataLayer || [];

    // @ts-ignore
    const originalDataLayer = window.dataLayer;
    const originalPush = originalDataLayer.push.bind(originalDataLayer);

    // capture already queued dataLayer items
    try {
      for (const existing of originalDataLayer) {
        pushStore("dataLayer", {
          payload: safeClone(existing),
          ts: Date.now(),
          source: "preexisting",
        });
      }
    } catch {}

    originalDataLayer.push = function (...args: any[]) {
      try {
        for (const arg of args) {
          pushStore("dataLayer", {
            payload: safeClone(arg),
            ts: Date.now(),
            source: "push",
          });
        }
      } catch {}

      return originalPush(...args);
    };

    // ------------------------------------------------------
    // 2) gtag interception
    // Handles:
    // - gtag already defined
    // - gtag defined later
    // - queued calls
    // ------------------------------------------------------
    const wrapGtag = (fn: any) => {
      if (typeof fn !== "function") return fn;
      // @ts-ignore
      if (fn.__pixelLensWrapped) return fn;

      const wrapped = function (...args: any[]) {
        try {
          pushStore("gtag", {
            args: safeClone(args),
            ts: Date.now(),
          });
        } catch {}

        return fn.apply(this, args);
      };

      // @ts-ignore
      wrapped.__pixelLensWrapped = true;

      try {
        for (const key in fn) {
          // @ts-ignore
          wrapped[key] = fn[key];
        }
      } catch {}

      return wrapped;
    };

    try {
      // @ts-ignore
      if (typeof window.gtag === "function") {
        // @ts-ignore
        window.gtag = wrapGtag(window.gtag);
      }
    } catch {}

    try {
      let internalGtag = null as any;

      Object.defineProperty(window, "gtag", {
        configurable: true,
        enumerable: true,
        get() {
          return internalGtag;
        },
        set(value) {
          internalGtag = wrapGtag(value);
        },
      });
    } catch {}

    // ------------------------------------------------------
    // 3) fbq interception
    // Handles:
    // - fbq already defined
    // - fbq defined later
    // ------------------------------------------------------
    const wrapFbq = (fn: any) => {
      if (typeof fn !== "function") return fn;
      // @ts-ignore
      if (fn.__pixelLensWrapped) return fn;

      const wrapped = function (...args: any[]) {
        try {
          pushStore("fbq", {
            args: safeClone(args),
            ts: Date.now(),
          });
        } catch {}

        return fn.apply(this, args);
      };

      // @ts-ignore
      wrapped.__pixelLensWrapped = true;

      try {
        for (const key in fn) {
          // @ts-ignore
          wrapped[key] = fn[key];
        }
      } catch {}

      return wrapped;
    };

    try {
      // @ts-ignore
      if (typeof window.fbq === "function") {
        // @ts-ignore
        window.fbq = wrapFbq(window.fbq);
      }
    } catch {}

    try {
      let internalFbq = null as any;

      Object.defineProperty(window, "fbq", {
        configurable: true,
        enumerable: true,
        get() {
          return internalFbq;
        },
        set(value) {
          internalFbq = wrapFbq(value);
        },
      });
    } catch {}

    // ------------------------------------------------------
    // 4) fetch interception
    // ------------------------------------------------------
    try {
      const originalFetch = window.fetch.bind(window);

      window.fetch = async function (input: any, init?: any) {
        const url =
          typeof input === "string"
            ? input
            : input?.url || String(input || "");

        const body = init?.body || null;

        try {
          pushNetworkSignal("fetch", url, body);
        } catch {}

        return originalFetch(input, init);
      };
    } catch {}

    // ------------------------------------------------------
    // 5) XMLHttpRequest interception
    // ------------------------------------------------------
    try {
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function (
        method: string,
        url: string | URL,
        async?: boolean,
        username?: string | null,
        password?: string | null
      ) {
        // @ts-ignore
        this.__pixelLensUrl = String(url || "");
        // @ts-ignore
        this.__pixelLensMethod = String(method || "GET");
        return originalOpen.call(this, method, url, async ?? true, username ?? null, password ?? null);
      };

      XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
        try {
          // @ts-ignore
          pushNetworkSignal("xhr", this.__pixelLensUrl || "", body || null);
        } catch {}

        return originalSend.call(this, body);
      };
    } catch {}

    // ------------------------------------------------------
    // 6) sendBeacon interception
    // ------------------------------------------------------
    try {
      const originalBeacon = navigator.sendBeacon.bind(navigator);

      navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null) {
        try {
          pushNetworkSignal("beacon", String(url || ""), data || null);
        } catch {}

        return originalBeacon(url, data);
      };
    } catch {}

    // ------------------------------------------------------
    // 7) Retry late hooks
    // Some sites define gtag/fbq after consent or after scripts load
    // ------------------------------------------------------
    let tries = 0;
    const interval = setInterval(() => {
      tries += 1;

      try {
        // @ts-ignore
        if (typeof window.gtag === "function") {
          // @ts-ignore
          window.gtag = wrapGtag(window.gtag);
        }
      } catch {}

      try {
        // @ts-ignore
        if (typeof window.fbq === "function") {
          // @ts-ignore
          window.fbq = wrapFbq(window.fbq);
        }
      } catch {}

      if (tries > 60) {
        clearInterval(interval);
      }
    }, 250);
  });
}

export async function collectUniversalTrackingData(page: any) {
  return await page.evaluate(() => {
    // @ts-ignore
    const store = window.__PIXELLENS_V2__ || {};

    return {
      startedAt: store.startedAt || null,
      dataLayer: Array.isArray(store.dataLayer) ? store.dataLayer : [],
      gtag: Array.isArray(store.gtag) ? store.gtag : [],
      fbq: Array.isArray(store.fbq) ? store.fbq : [],
      fetch: Array.isArray(store.fetch) ? store.fetch : [],
      xhr: Array.isArray(store.xhr) ? store.xhr : [],
      beacon: Array.isArray(store.beacon) ? store.beacon : [],
      networkSignals: store.networkSignals || {
        ga4: [],
        meta: [],
        googleAds: [],
        other: [],
      },
    };
  });
}