/* lib/scanner/quick.ts */

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type Finding = {
  id: string;
  title: string;
  severity: Severity;
  category: "GA4" | "GTM" | "META" | "CONSENT" | "GENERAL";
  evidence?: string[];
  impact?: string;
  recommendation?: string;
};

export type QuickScanResult = {
  url: string;
  fetchedUrl: string;
  status: number;
  signals: {
    gtmIds: string[];
    ga4Ids: string[];
    hasGtagLoader: boolean;
    hasGtmLoader: boolean;
    hasMetaPixel: boolean;
    hasMetaEventsJs: boolean;
    cmpProviders: string[];
    hasConsentModeSignals: boolean;
  };
  categoryScores: Record<string, number>;
  overallScore: number;
  findings: Finding[];
  raw: {
    bytes: number;
    snippet: string;
    headers: Record<string, string>;
  };
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

function scoreClamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Minimal SSRF protection:
 * - blocks localhost, private IPs, file:, ftp:, etc.
 * - allows only http/https
 */
function assertSafeUrl(input: string) {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(u.protocol)) {
    throw new Error("Only http/https URLs are allowed");
  }

  const host = u.hostname.toLowerCase();

  // Block localhost
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    throw new Error("Blocked host");
  }

  // Block common private TLD / internal
  if (
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan")
  ) {
    throw new Error("Blocked host");
  }

  // Block plain private IP ranges (simple check)
  // NOTE: This is basic. Phase 2 / prod should resolve DNS & check IPs.
  const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (isIPv4) {
    const parts = host.split(".").map((p) => Number(p));
    const [a, b] = parts;

    const in10 = a === 10;
    const in172 = a === 172 && b >= 16 && b <= 31;
    const in192 = a === 192 && b === 168;
    const in127 = a === 127;

    if (in10 || in172 || in192 || in127) {
      throw new Error("Blocked private IP");
    }
  }

  return u;
}

async function fetchHtml(url: string) {
  const u = assertSafeUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(u.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "PixelLensQuickScanner/1.0 (+https://pixellens.local; bot)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();

    return {
      status: res.status,
      fetchedUrl: res.url,
      contentType,
      html: text,
      headers: Object.fromEntries(res.headers.entries()),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractAll(regex: RegExp, text: string) {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const r = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
  while ((m = r.exec(text))) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

function detectCmp(html: string) {
  const s = html.toLowerCase();
  const providers: string[] = [];

  const checks: Array<[string, string[]]> = [
    ["OneTrust", ["onetrust", "ot-sdk", "cookiepro"]],
    ["Cookiebot", ["cookiebot"]],
    ["Didomi", ["didomi"]],
    ["Iubenda", ["iubenda"]],
    ["Axeptio", ["axeptio"]],
    ["Quantcast", ["quantcast", "choice"]],
    ["CookieYes", ["cookieyes"]],
    ["Tarteaucitron", ["tarteaucitron"]],
  ];

  for (const [name, keys] of checks) {
    if (keys.some((k) => s.includes(k))) providers.push(name);
  }

  const consentMode =
    s.includes("gtag('consent") ||
    s.includes('gtag("consent') ||
    s.includes("default_consent") ||
    s.includes("ad_storage") ||
    s.includes("analytics_storage");

  return { providers: uniq(providers), consentMode };
}

function buildFindings(signals: QuickScanResult["signals"]): Finding[] {
  const findings: Finding[] = [];

  // GTM
  if (!signals.hasGtmLoader && signals.gtmIds.length === 0) {
    findings.push({
      id: "gtm_missing",
      title: "GTM not detected",
      severity: "HIGH",
      category: "GTM",
      impact: "Harder tag governance and tracking consistency across the site.",
      recommendation:
        "Install Google Tag Manager container on all pages or confirm server-side tagging strategy.",
    });
  } else {
    findings.push({
      id: "gtm_detected",
      title: "GTM detected",
      severity: "INFO",
      category: "GTM",
      evidence: signals.gtmIds.length ? signals.gtmIds : undefined,
    });
  }

  // GA4
  if (signals.ga4Ids.length === 0 && !signals.hasGtagLoader) {
    findings.push({
      id: "ga4_missing",
      title: "GA4 not detected",
      severity: "CRITICAL",
      category: "GA4",
      impact: "No analytics measurement detected. Attribution and reporting will be unreliable.",
      recommendation:
        "Install GA4 via GTM or gtag.js, and ensure it loads on all pages with correct Measurement ID.",
    });
  } else {
    findings.push({
      id: "ga4_detected",
      title: "GA4 / gtag detected",
      severity: "INFO",
      category: "GA4",
      evidence: signals.ga4Ids.length ? signals.ga4Ids : undefined,
    });
  }

  // Meta Pixel
  if (!signals.hasMetaPixel && !signals.hasMetaEventsJs) {
    findings.push({
      id: "meta_missing",
      title: "Meta Pixel not detected",
      severity: "HIGH",
      category: "META",
      impact: "Meta Ads optimization and retargeting will be limited.",
      recommendation:
        "Install Meta Pixel (and later CAPI) and validate event coverage (ViewContent/AddToCart/Purchase).",
    });
  } else {
    findings.push({
      id: "meta_detected",
      title: "Meta Pixel signals detected",
      severity: "INFO",
      category: "META",
      evidence: [
        signals.hasMetaPixel ? "fbq() found" : "",
        signals.hasMetaEventsJs ? "fbevents.js found" : "",
      ].filter(Boolean),
    });
  }

  // Consent
  if (signals.cmpProviders.length === 0 && !signals.hasConsentModeSignals) {
    findings.push({
      id: "consent_unknown",
      title: "Consent mechanism not detected",
      severity: "MEDIUM",
      category: "CONSENT",
      impact:
        "Risk of non-compliant tracking or dropped events depending on country and user consent requirements.",
      recommendation:
        "Implement a CMP (OneTrust/Cookiebot/Didomi/etc.) and configure Google Consent Mode v2.",
    });
  } else {
    findings.push({
      id: "consent_detected",
      title: "Consent signals detected",
      severity: "INFO",
      category: "CONSENT",
      evidence: [
        ...signals.cmpProviders,
        signals.hasConsentModeSignals ? "Consent Mode signals" : "",
      ].filter(Boolean),
    });
  }

  return findings;
}

function computeScores(signals: QuickScanResult["signals"]) {
  // Simple, factual scoring (Phase 1)
  let gtm = 0;
  if (signals.hasGtmLoader || signals.gtmIds.length) gtm = 90;
  if (signals.hasGtmLoader && signals.gtmIds.length) gtm = 100;

  let ga4 = 0;
  if (signals.hasGtagLoader || signals.ga4Ids.length) ga4 = 80;
  if (signals.hasGtagLoader && signals.ga4Ids.length) ga4 = 90;

  let meta = 0;
  if (signals.hasMetaEventsJs || signals.hasMetaPixel) meta = 70;
  if (signals.hasMetaEventsJs && signals.hasMetaPixel) meta = 85;

  let consent = 0;
  if (signals.cmpProviders.length) consent = 70;
  if (signals.hasConsentModeSignals) consent = Math.max(consent, 80);
  if (signals.cmpProviders.length && signals.hasConsentModeSignals) consent = 90;

  const overall = scoreClamp((ga4 + gtm + meta + consent) / 4);

  return {
    categoryScores: { ga4, gtm, meta, consent },
    overallScore: overall,
  };
}

export async function quickScan(url: string): Promise<QuickScanResult> {
  const { status, fetchedUrl, html, headers } = await fetchHtml(url);

  // --- DETECTION (regex-based, factual) ---
  const gtmIds = uniq([
    ...extractAll(/GTM-([A-Z0-9]{5,})/gi, html).map((x) => `GTM-${x}`),
  ]);

  const ga4Ids = uniq([
    ...extractAll(/G-([A-Z0-9]{8,})/gi, html).map((x) => `G-${x}`),
  ]);

  const hasGtagLoader =
    /googletagmanager\.com\/gtag\/js\?id=G-/i.test(html) ||
    /gtag\(/i.test(html);

  const hasGtmLoader =
    /googletagmanager\.com\/gtm\.js\?id=GTM-/i.test(html) ||
    /dataLayer\s*=\s*dataLayer\s*\|\|\s*\[\]/i.test(html);

  const hasMetaEventsJs = /connect\.facebook\.net\/.*\/fbevents\.js/i.test(html);
const hasMetaPixel = html.includes("fbq(") || html.includes("fbevents.js");

  const cmp = detectCmp(html);

  const signals: QuickScanResult["signals"] = {
    gtmIds,
    ga4Ids,
    hasGtagLoader,
    hasGtmLoader,
    hasMetaPixel,
    hasMetaEventsJs,
    cmpProviders: cmp.providers,
    hasConsentModeSignals: cmp.consentMode,
  };

  const findings = buildFindings(signals);
  const { categoryScores, overallScore } = computeScores(signals);

  const snippet = html.slice(0, 1200);

  return {
    url,
    fetchedUrl,
    status,
    signals,
    categoryScores,
    overallScore,
    findings,
    raw: {
      bytes: Buffer.byteLength(html, "utf8"),
      snippet,
      headers,
    },
  };
}