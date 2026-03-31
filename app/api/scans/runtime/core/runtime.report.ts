import { buildMetaAudit } from "../modules/meta/meta.audit";
import { buildMetaFunnel } from "../modules/meta/meta.funnel";
import { buildMetaInsights } from "../modules/meta/meta.insights";

import { buildGA4Audit } from "../modules/ga4/ga4.audit";
import { buildGA4Funnel } from "../modules/ga4/ga4.funnel";
import { buildGA4Insights } from "../modules/ga4/ga4.insights";

import { buildGTMAudit } from "../modules/gtm/gtm.audit";

import { buildGoogleAdsAudit } from "../modules/google-ads/ads.audit";
import { buildGoogleAdsInsights } from "../modules/google-ads/ads.insights";

import type {
  RuntimeReport,
  RuntimeScanResult,
  ValidationCheck,
} from "./runtime.types";

// =========================================================
// HELPERS — GENERIC SCORING UTILS
// =========================================================

function scoreClamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function statusToScore(status: string) {
  if (status === "CONFIRMED" || status === "OK") return 100;
  if (status === "PARTIAL") return 55;
  if (status === "UNVERIFIED") return 25;
  return 0;
}

function priorityPenalty(priority: string) {
  if (priority === "HIGH") return 8;
  if (priority === "MEDIUM") return 3;
  return 0;
}

function uniqStrings(arr: string[]) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

// =========================================================
// HELPERS — DATALAYER ECOMMERCE NORMALIZATION
// IMPORTANT:
// Many GTM setups push ecommerce data like:
// {
//   event: "add_to_cart",
//   ecommerce: { items: [...], value: 10, currency: "TND" }
// }
//
// But ga4.audit.ts expects:
// {
//   items: [...],
//   value: 10,
//   currency: "TND"
// }
//
// This block flattens ecommerce.* into top-level params
// so PixelLens stops producing false negatives.
// =========================================================

function normalizeGA4ParamsFromDataLayer(eventName: string, payload: Record<string, any>) {
  const clone = { ...(payload || {}) };
  delete clone.event;

  const ecommerce =
    clone?.ecommerce && typeof clone.ecommerce === "object" ? clone.ecommerce : null;

  // -------------------------------------------------------
  // Base params = original payload without "event"
  // -------------------------------------------------------
  let normalized: Record<string, any> = { ...clone };

  // -------------------------------------------------------
  // If ecommerce object exists, flatten it to top-level
  // Example:
  // ecommerce.items -> items
  // ecommerce.value -> value
  // ecommerce.currency -> currency
  // -------------------------------------------------------
  if (ecommerce) {
    normalized = {
      ...normalized,
      ...ecommerce,
    };
  }

  // -------------------------------------------------------
  // Common real-world GTM / Woo / custom fallbacks
  // -------------------------------------------------------
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

  if (!normalized.value && ecommerce?.value !== undefined) {
    normalized.value = ecommerce.value;
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

  // -------------------------------------------------------
  // Purchase-specific common aliases
  // -------------------------------------------------------
  if (eventName === "purchase") {
    if (!normalized.value && ecommerce?.revenue !== undefined) {
      normalized.value = ecommerce.revenue;
    }

    if (!normalized.currency && ecommerce?.currencyCode) {
      normalized.currency = ecommerce.currencyCode;
    }
  }

  return normalized;
}

// =========================================================
// HELPERS — UNIVERSAL INTERCEPTOR EXTRACTION
// Rebuild GA4 payloads from:
// - native gtag captures
// - dataLayer interceptor
// - GA4 network captures
// =========================================================

function extractGA4PayloadsFromUniversal(raw: any) {
  const interceptor = raw?.trackingPayloads?.universalInterceptor ?? {};
  const existing = Array.isArray(raw?.trackingPayloads?.ga4Payloads)
    ? raw.trackingPayloads.ga4Payloads
    : [];

  // -------------------------------------------------------
  // Existing payloads are kept, but normalized too
  // in case they contain ecommerce nested structure
  // -------------------------------------------------------
  const normalizedExisting = existing
    .map((entry: any) => {
      const ev = String(entry?.event || "").toLowerCase();
      if (!ev) return null;

      return {
        ...entry,
        event: ev,
        params: normalizeGA4ParamsFromDataLayer(ev, entry?.params || {}),
      };
    })
    .filter(Boolean);

  // -------------------------------------------------------
  // GA4 direct gtag(...) captures
  // -------------------------------------------------------
  const extractedFromGtag = Array.isArray(interceptor?.gtag)
    ? interceptor.gtag
        .map((entry: any) => {
          const args = Array.isArray(entry?.args) ? entry.args : [];
          const [cmd, event, params] = args;

          if (String(cmd || "") !== "event" || !event) return null;

          const ev = String(event).toLowerCase();

          return {
            event: ev,
            params: normalizeGA4ParamsFromDataLayer(ev, params || {}),
            ts: entry?.ts || Date.now(),
            source: "gtag-interceptor",
          };
        })
        .filter(Boolean)
    : [];

  // -------------------------------------------------------
  // dataLayer captures
  // This is the critical fix for Woo / GTM preview parity
  // -------------------------------------------------------
  const extractedFromDataLayer = Array.isArray(interceptor?.dataLayer)
    ? interceptor.dataLayer
        .map((entry: any) => {
          const payload = entry?.payload;
          if (!payload || typeof payload !== "object") return null;

          const ev = String(payload?.event || "").toLowerCase();
          if (!ev) return null;

          const allowed = ["view_item", "add_to_cart", "begin_checkout", "purchase"];
          if (!allowed.includes(ev)) return null;

          return {
            event: ev,
            params: normalizeGA4ParamsFromDataLayer(ev, payload),
            ts: entry?.ts || Date.now(),
            source: "datalayer-interceptor",
          };
        })
        .filter(Boolean)
    : [];

  // -------------------------------------------------------
  // GA4 network captures
  // Kept as fallback, but normalized too
  // -------------------------------------------------------
  const extractedFromNetwork = Array.isArray(raw?.trackingPayloads?.ga4NetworkEvents)
    ? raw.trackingPayloads.ga4NetworkEvents
        .map((entry: any) => {
          const ev = String(entry?.event || "").toLowerCase();
          if (!ev) return null;

          const allowed = ["view_item", "add_to_cart", "begin_checkout", "purchase"];
          if (!allowed.includes(ev)) return null;

          return {
            event: ev,
            params: normalizeGA4ParamsFromDataLayer(ev, entry?.params || {}),
            ts: entry?.ts || Date.now(),
            source: "ga4-network",
          };
        })
        .filter(Boolean)
    : [];

  const merged = [
    ...normalizedExisting,
    ...extractedFromGtag,
    ...extractedFromDataLayer,
    ...extractedFromNetwork,
  ];

  const seen = new Set<string>();

  return merged.filter((item: any) => {
    const key = JSON.stringify({
      event: item?.event || "",
      params: item?.params || {},
      source: item?.source || "",
    });

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// =========================================================
// HELPERS — META EXTRACTION
// Rebuild Meta payloads from universal interceptor
// =========================================================

function extractMetaPayloadsFromUniversal(raw: any) {
  const interceptor = raw?.trackingPayloads?.universalInterceptor ?? {};
  const existing = Array.isArray(raw?.trackingPayloads?.metaPayloads)
    ? raw.trackingPayloads.metaPayloads
    : [];

  const extractedFromFbq = Array.isArray(interceptor?.fbq)
    ? interceptor.fbq
        .map((entry: any) => {
          const args = Array.isArray(entry?.args) ? entry.args : [];
          const [cmd, event, params] = args;

          if (!cmd || !event) return null;
          if (!["track", "trackCustom"].includes(String(cmd))) return null;

          return {
            cmd: String(cmd),
            event: String(event),
            params: params || {},
            ts: entry?.ts || Date.now(),
            source: "fbq-interceptor",
          };
        })
        .filter(Boolean)
    : [];

  const merged = [...existing, ...extractedFromFbq];

  const seen = new Set<string>();

  return merged.filter((item: any) => {
    const key = JSON.stringify({
      cmd: item?.cmd || "",
      event: item?.event || "",
      params: item?.params || {},
      source: item?.source || "",
    });

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// =========================================================
// HELPERS — VALIDATION STATUS FOR UI + SCORE
// =========================================================

function buildValidationFromCounts(args: {
  check: string;
  confirmedCount: number;
  testedCount: number;
  attempted?: boolean;
  actionWhenMissing: string;
  partialThreshold?: number;
}): ValidationCheck {
  const {
    check,
    confirmedCount,
    testedCount,
    attempted,
    actionWhenMissing,
    partialThreshold = 1,
  } = args;

  const status =
    confirmedCount >= 2
      ? "CONFIRMED"
      : confirmedCount >= partialThreshold
      ? "PARTIAL"
      : attempted
      ? "NOT_CONFIRMED"
      : "UNVERIFIED";

  const confidence =
    confirmedCount >= 2
      ? "HIGH"
      : confirmedCount >= partialThreshold
      ? "MEDIUM"
      : attempted
      ? "LOW"
      : "LOW";

  return {
    check,
    status,
    confidence,
    evidence:
      testedCount > 0
        ? `Confirmed on ${confirmedCount}/${testedCount} page(s)`
        : `No ${check} page tested`,
    action:
      confirmedCount >= 2 || confirmedCount >= partialThreshold
        ? "None"
        : actionWhenMissing,
  };
}

function validationStatusScore(validations: ValidationCheck[], checkName: string) {
  const check = validations.find((v) => v.check === checkName);
  if (!check) return 0;
  if (check.status === "CONFIRMED") return 100;
  if (check.status === "PARTIAL") return 55;
  if (check.status === "UNVERIFIED") return 20;
  return 0;
}

// =========================================================
// MAIN BUILDER — RUNTIME REPORT
// =========================================================

export function buildRuntimeReport(result: RuntimeScanResult): RuntimeReport {
  const { signals, validation, raw } = result;

  // =======================================================
  // 1) REBUILD PAYLOADS FROM INTERCEPTOR
  // =======================================================
  const metaPayloads = extractMetaPayloadsFromUniversal(raw);
  const ga4Payloads = extractGA4PayloadsFromUniversal(raw);

  // =======================================================
  // 2) RUN MODULE ENGINES
  // =======================================================
  const metaAudit = buildMetaAudit(metaPayloads);
  const metaFunnel = buildMetaFunnel(metaAudit);
  const metaInsights = buildMetaInsights(metaAudit, metaFunnel);

  const ga4Audit = buildGA4Audit(ga4Payloads);
  const ga4Funnel = buildGA4Funnel(ga4Audit);
  const ga4Insights = buildGA4Insights(ga4Audit, ga4Funnel);

  const gtmAudit = buildGTMAudit(signals.gtmIds);

  const googleAdsAudit = buildGoogleAdsAudit({
    awIds: Array.isArray(signals?.googleAdsIds) ? signals.googleAdsIds : [],
    conversionLabels: Array.isArray(signals?.googleAdsConversionLabels)
      ? signals.googleAdsConversionLabels
      : [],
    conversionEvents: Array.isArray(signals?.googleAdsConversionEvents)
      ? signals.googleAdsConversionEvents
      : [],
    remarketingDetected: Boolean(signals?.googleAdsRemarketingDetected),
  });

  const googleAdsInsights = buildGoogleAdsInsights(googleAdsAudit);

  // =======================================================
  // 3) BUILD VALIDATIONS
  // =======================================================
  const validations: ValidationCheck[] = [];

  validations.push({
    check: "GTM",
    status: gtmAudit.status,
    confidence: gtmAudit.confidence,
    evidence: gtmAudit.evidence,
    action: gtmAudit.action,
  });

  validations.push({
    check: "GA4",
    status:
      signals.ga4Requests > 0 ||
      signals.ga4MeasurementIds.length > 0 ||
      ga4Payloads.length > 0
        ? "CONFIRMED"
        : "NOT_CONFIRMED",
    confidence:
      ga4Payloads.length > 0 || signals.ga4Requests > 0
        ? "HIGH"
        : signals.ga4MeasurementIds.length > 0
        ? "MEDIUM"
        : "LOW",
    evidence:
      ga4Payloads.length > 0
        ? `Measurement IDs: ${uniqStrings(signals.ga4MeasurementIds).join(", ") || "Unknown"} · Payloads captured: ${ga4Payloads.length}`
        : signals.ga4MeasurementIds.length > 0
        ? `Measurement IDs: ${uniqStrings(signals.ga4MeasurementIds).join(", ")}`
        : "No GA4 requests observed",
    action:
      ga4Payloads.length > 0 ||
      signals.ga4Requests > 0 ||
      signals.ga4MeasurementIds.length > 0
        ? "None"
        : "Verify GA4 configuration and GTM triggers",
  });

  validations.push({
    check: "Meta Pixel",
    status: signals.metaPixel || metaPayloads.length > 0 ? "CONFIRMED" : "NOT_CONFIRMED",
    confidence: metaPayloads.length > 0 || signals.metaPixel ? "HIGH" : "LOW",
    evidence:
      signals.metaPixelIds.length > 0
        ? `Pixel IDs: ${uniqStrings(signals.metaPixelIds).join(", ")} · Payloads captured: ${metaPayloads.length}`
        : metaPayloads.length > 0
        ? `Meta payloads captured: ${metaPayloads.length}`
        : "facebook.com/tr endpoint not detected",
    action:
      signals.metaPixel || metaPayloads.length > 0
        ? "None"
        : "Install Meta Pixel or verify tracking setup",
  });

  validations.push({
    check: "Google Ads",
    status: googleAdsAudit.status,
    confidence: googleAdsAudit.confidence,
    evidence: googleAdsAudit.evidence,
    action: googleAdsAudit.action,
  });

  validations.push({
    check: "Consent",
    status: signals.consentSeen ? "CONFIRMED" : "UNVERIFIED",
    confidence: signals.consentSeen ? "HIGH" : "LOW",
    evidence: signals.consentSeen
      ? "CMP or consent signal detected"
      : "No CMP interaction detected",
    action: signals.consentSeen
      ? "Review consent behavior"
      : "Implement CMP and configure GTM consent mode",
  });

  const viewItemConfirmedCount = validation.view_item?.confirmedPages?.length || 0;
  const viewItemTestedCount = validation.view_item?.testedPages?.length || 0;

  validations.push(
    buildValidationFromCounts({
      check: "view_item",
      confirmedCount: viewItemConfirmedCount,
      testedCount: viewItemTestedCount,
      attempted: validation.view_item?.attempted,
      actionWhenMissing: "Review product page ecommerce mapping",
      partialThreshold: 1,
    })
  );

  const addToCartConfirmedCount = validation.add_to_cart?.confirmedPages?.length || 0;
  const addToCartTestedCount = validation.add_to_cart?.testedPages?.length || 0;

  validations.push(
    buildValidationFromCounts({
      check: "add_to_cart",
      confirmedCount: addToCartConfirmedCount,
      testedCount: addToCartTestedCount,
      attempted: validation.add_to_cart?.attempted,
      actionWhenMissing: "Validate add_to_cart trigger and ecommerce payload",
      partialThreshold: 1,
    })
  );

  const beginCheckoutConfirmedCount =
    validation.begin_checkout?.confirmedPages?.length || 0;
  const beginCheckoutTestedCount =
    validation.begin_checkout?.testedPages?.length || 0;

  validations.push(
    buildValidationFromCounts({
      check: "begin_checkout",
      confirmedCount: beginCheckoutConfirmedCount,
      testedCount: beginCheckoutTestedCount,
      attempted: validation.begin_checkout?.attempted,
      actionWhenMissing:
        "Validate begin_checkout firing when the user enters checkout",
      partialThreshold: 1,
    })
  );

  const purchaseConfirmedCount = validation.purchase?.confirmedPages?.length || 0;
  const purchaseTestedCount = validation.purchase?.testedPages?.length || 0;

  validations.push(
    buildValidationFromCounts({
      check: "purchase",
      confirmedCount: purchaseConfirmedCount,
      testedCount: purchaseTestedCount,
      attempted: validation.purchase?.attempted,
      actionWhenMissing:
        "Validate purchase firing on confirmation page with transaction_id, value, currency, and items",
      partialThreshold: 1,
    })
  );

  validations.push({
    check: "CAPI",
    status: "UNVERIFIED",
    confidence: "LOW",
    evidence: "Browser scan cannot fully verify server-side signals",
    action: "Validate Meta CAPI server-side outside browser-only scan",
  });

  // =======================================================
  // 4) MODULE SCORES
  // =======================================================
  const metaPayloadScore = avg(metaAudit.map((e) => e.payloadQualityScore));
  const ga4PayloadScore = avg(ga4Audit.map((e) => e.payloadQualityScore));

  const metaCriticalCount = metaAudit.reduce(
    (sum, e) => sum + (e.criticalIssues?.length || 0),
    0
  );
  const ga4CriticalCount = ga4Audit.reduce(
    (sum, e) => sum + (e.criticalIssues?.length || 0),
    0
  );

  const metaScore = scoreClamp(
    Math.round(
      metaFunnel.score * 0.55 +
        metaPayloadScore * 0.35 +
        statusToScore(
          signals.metaPixel || metaPayloads.length > 0 ? "CONFIRMED" : "NOT_CONFIRMED"
        ) *
          0.1
    ) - metaCriticalCount * 4
  );

  const ga4EcommerceValidationScore = Math.round(
    validationStatusScore(validations, "view_item") * 0.2 +
      validationStatusScore(validations, "add_to_cart") * 0.25 +
      validationStatusScore(validations, "begin_checkout") * 0.25 +
      validationStatusScore(validations, "purchase") * 0.3
  );

  const ga4Score = scoreClamp(
    Math.round(
      ga4Funnel.score * 0.45 +
        ga4PayloadScore * 0.3 +
        ga4EcommerceValidationScore * 0.15 +
        statusToScore(
          signals.ga4Requests > 0 ||
            signals.ga4MeasurementIds.length > 0 ||
            ga4Payloads.length > 0
            ? "CONFIRMED"
            : "NOT_CONFIRMED"
        ) *
          0.1
    ) - ga4CriticalCount * 4
  );

  const gtmScore = scoreClamp(statusToScore(gtmAudit.status));

  const googleAdsScore = scoreClamp(
    Math.round(
      statusToScore(googleAdsAudit.status) * 0.5 +
        (googleAdsAudit.awIds.length > 0 ? 15 : 0) +
        (googleAdsAudit.conversionLabels.length > 0 ? 20 : 0) +
        (googleAdsAudit.conversionEvents.length > 0 ? 10 : 0) +
        (googleAdsAudit.remarketingDetected ? 5 : 0)
    )
  );

  const consentScore = scoreClamp(
    statusToScore(signals.consentSeen ? "CONFIRMED" : "UNVERIFIED")
  );

  const capiScore = 0;

  // =======================================================
  // 5) CATEGORY SCORES
  // =======================================================
  const categoryScores = {
    gtm: gtmScore,
    ga4: ga4Score,
    meta: metaScore,
    googleAds: googleAdsScore,
    consent: consentScore,
    capi: capiScore,
  };

  // =======================================================
  // 6) GLOBAL SCORE
  // =======================================================
  const weightedBaseScore = Math.round(
    categoryScores.gtm * 0.16 +
      categoryScores.ga4 * 0.24 +
      categoryScores.meta * 0.24 +
      categoryScores.googleAds * 0.16 +
      categoryScores.consent * 0.1 +
      categoryScores.capi * 0.1
  );

  const allInsights = [
    ...metaInsights.map((i) => ({ source: "meta", ...i })),
    ...ga4Insights.map((i) => ({ source: "ga4", ...i })),
    ...googleAdsInsights.map((i) => ({ source: "googleAds", ...i })),
  ];

  const insightsPenalty = allInsights.reduce(
    (sum, insight) => sum + priorityPenalty(insight.priority),
    0
  );

  const finalScore = scoreClamp(weightedBaseScore - insightsPenalty);

  // =======================================================
  // 7) SHORT GLOBAL INSIGHTS FOR OVERVIEW TAB
  // =======================================================
  const insights = [
    categoryScores.gtm >= 80 && categoryScores.ga4 >= 70
      ? "GTM and GA4 foundations are confirmed."
      : "Tracking foundations are only partially confirmed.",
    categoryScores.meta >= 75
      ? "Meta tracking quality is strong."
      : categoryScores.meta >= 45
      ? "Meta tracking is partially working but needs hardening."
      : "Meta tracking quality is weak and needs urgent review.",
    categoryScores.googleAds >= 75
      ? "Google Ads conversion setup looks healthy."
      : categoryScores.googleAds >= 45
      ? "Google Ads setup is partially confirmed."
      : "Google Ads conversion setup is weak or incomplete.",
    ga4Payloads.length > 0
      ? `GA4 payload capture is active (${ga4Payloads.length} payloads captured).`
      : "GA4 payload capture is not confirmed yet.",
    metaPayloads.length > 0
      ? `Meta payload capture is active (${metaPayloads.length} payloads captured).`
      : "Meta payload capture is not confirmed yet.",
    `view_item confirmed on ${viewItemConfirmedCount}/${viewItemTestedCount} product page(s).`,
    `add_to_cart confirmed on ${addToCartConfirmedCount}/${addToCartTestedCount} product page(s).`,
    `begin_checkout confirmed on ${beginCheckoutConfirmedCount}/${beginCheckoutTestedCount} page(s).`,
    `purchase confirmed on ${purchaseConfirmedCount}/${purchaseTestedCount} page(s).`,
    `PixelLens tested ${raw?.v2?.productPagesTested?.length || 0} product page(s).`,
  ];

  // =======================================================
  // 8) INTERCEPTOR DEBUG — USED IN UI DEBUG PANEL
  // =======================================================
  const interceptorDebug = {
    dataLayerCount: Array.isArray(raw?.trackingPayloads?.universalInterceptor?.dataLayer)
      ? raw.trackingPayloads.universalInterceptor.dataLayer.length
      : 0,
    gtagCount: Array.isArray(raw?.trackingPayloads?.universalInterceptor?.gtag)
      ? raw.trackingPayloads.universalInterceptor.gtag.length
      : 0,
    fbqCount: Array.isArray(raw?.trackingPayloads?.universalInterceptor?.fbq)
      ? raw.trackingPayloads.universalInterceptor.fbq.length
      : 0,
    fetchCount: Array.isArray(raw?.trackingPayloads?.universalInterceptor?.fetch)
      ? raw.trackingPayloads.universalInterceptor.fetch.length
      : 0,
    xhrCount: Array.isArray(raw?.trackingPayloads?.universalInterceptor?.xhr)
      ? raw.trackingPayloads.universalInterceptor.xhr.length
      : 0,
    beaconCount: Array.isArray(raw?.trackingPayloads?.universalInterceptor?.beacon)
      ? raw.trackingPayloads.universalInterceptor.beacon.length
      : 0,
  };

  // =======================================================
  // 9) EXECUTIVE SUMMARY — USED IN OVERVIEW
  // =======================================================
  const executiveSummary =
    `PixelLens Runtime Audit V2\n\n` +
    `Platform: ${raw.report.platform}\n` +
    `Page type: ${raw.report.pageType}\n` +
    `Category pages tested: ${raw?.v2?.categoryPagesTested?.length || 0}\n` +
    `Product pages tested: ${raw?.v2?.productPagesTested?.length || 0}\n` +
    `Cart pages tested: ${raw?.v2?.cartPagesTested?.length || 0}\n` +
    `Checkout pages tested: ${raw?.v2?.checkoutPagesTested?.length || 0}\n` +
    `Purchase pages tested: ${raw?.v2?.purchasePagesTested?.length || 0}\n\n` +
    `Tracking Health Score: ${finalScore}/100\n` +
    `GTM Score: ${categoryScores.gtm}/100\n` +
    `GA4 Score: ${categoryScores.ga4}/100\n` +
    `Meta Score: ${categoryScores.meta}/100\n` +
    `Google Ads Score: ${categoryScores.googleAds}/100\n` +
    `Consent Score: ${categoryScores.consent}/100\n\n` +
    `GTM: ${signals.gtmIds.length ? "confirmed" : "not confirmed"}\n` +
    `GA4: ${signals.ga4Requests > 0 || signals.ga4MeasurementIds.length > 0 || ga4Payloads.length > 0 ? "confirmed" : "not confirmed"}\n` +
    `Meta Pixel: ${signals.metaPixel || metaPayloads.length > 0 ? "confirmed" : "not confirmed"}\n` +
    `Google Ads: ${googleAdsAudit.status.toLowerCase()}\n` +
    `Consent: ${signals.consentSeen ? "detected" : "unverified"}\n\n` +
    `GA4 payloads captured: ${ga4Payloads.length}\n` +
    `Meta payloads captured: ${metaPayloads.length}\n` +
    `Interceptor gtag captures: ${interceptorDebug.gtagCount}\n` +
    `Interceptor dataLayer captures: ${interceptorDebug.dataLayerCount}\n` +
    `Interceptor fbq captures: ${interceptorDebug.fbqCount}\n\n` +
    `view_item: confirmed on ${viewItemConfirmedCount}/${viewItemTestedCount} product page(s)\n` +
    `add_to_cart: confirmed on ${addToCartConfirmedCount}/${addToCartTestedCount} product page(s)\n` +
    `begin_checkout: confirmed on ${beginCheckoutConfirmedCount}/${beginCheckoutTestedCount} page(s)\n` +
    `purchase: confirmed on ${purchaseConfirmedCount}/${purchaseTestedCount} page(s)\n`;

  // =======================================================
  // 10) REPORT ENRICHMENT — UI READS THESE FIELDS
  // =======================================================
  raw.report.confidence =
    finalScore >= 75 ? "HIGH" : finalScore >= 45 ? "MEDIUM" : "LOW";
  raw.report.insights = insights;
  raw.report.checks = validations;

  (raw.report as any).metaInspector = {
    totalCapturedMetaPayloads: metaPayloads.length,
    score: metaScore,
    events: metaAudit,
    funnel: metaFunnel,
    insights: metaInsights,
  };

  (raw.report as any).ga4Inspector = {
    totalCapturedGA4Payloads: ga4Payloads.length,
    score: ga4Score,
    events: ga4Audit,
    funnel: ga4Funnel,
    insights: ga4Insights,
    debug: interceptorDebug,
  };

  (raw.report as any).googleAdsInspector = {
    detected: googleAdsAudit.detected,
    score: googleAdsScore,
    awIds: googleAdsAudit.awIds,
    conversionLabels: googleAdsAudit.conversionLabels,
    conversionEvents: googleAdsAudit.conversionEvents,
    remarketingDetected: googleAdsAudit.remarketingDetected,
    status: googleAdsAudit.status,
    confidence: googleAdsAudit.confidence,
    evidence: googleAdsAudit.evidence,
    action: googleAdsAudit.action,
    insights: googleAdsInsights,
  };

  return {
    overallScore: finalScore,
    categoryScores,
    validations,
    executiveSummary,
    raw,
  };
}