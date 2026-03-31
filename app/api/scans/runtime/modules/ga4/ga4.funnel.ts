import type { GA4EventAudit } from "./ga4.types";

// =========================================================
// GA4 FUNNEL TYPES
// =========================================================

type GA4FunnelStep = {
  step: "view_item" | "add_to_cart" | "begin_checkout" | "purchase";
  detected: boolean;
  status: "OK" | "PARTIAL" | "MISSING";
  count: number;
  payloadQualityScore: number;
  criticalIssues: string[];
};

type GA4FunnelResult = {
  score: number;
  mainRisk: string;
  steps: GA4FunnelStep[];
};

// =========================================================
// HELPER — GET EVENT AUDIT BY NAME
// =========================================================

function getEventAudit(ga4Audit: GA4EventAudit[], eventName: string) {
  return ga4Audit.find((item) => item.event === eventName) || null;
}

// =========================================================
// HELPER — STEP STATUS
// RULES
// - OK      => event detected + payload score is strong
// - PARTIAL => event detected but payload is weak
// - MISSING => event not detected
// =========================================================

function getStepStatus(eventAudit: GA4EventAudit | null): "OK" | "PARTIAL" | "MISSING" {
  if (!eventAudit || eventAudit.count <= 0) {
    return "MISSING";
  }

  if (eventAudit.payloadQualityScore >= 70) {
    return "OK";
  }

  return "PARTIAL";
}

// =========================================================
// HELPER — STEP SCORE
// Simple business weighting per event quality
// =========================================================

function getStepScore(status: "OK" | "PARTIAL" | "MISSING") {
  if (status === "OK") return 100;
  if (status === "PARTIAL") return 50;
  return 0;
}

// =========================================================
// HELPER — MAIN RISK
// We prioritize the deepest missing event first
// =========================================================

function getMainRisk(steps: GA4FunnelStep[]) {
  const purchase = steps.find((s) => s.step === "purchase");
  const beginCheckout = steps.find((s) => s.step === "begin_checkout");
  const addToCart = steps.find((s) => s.step === "add_to_cart");
  const viewItem = steps.find((s) => s.step === "view_item");

  if (!purchase || purchase.status === "MISSING") {
    return "purchase event missing";
  }

  if (!beginCheckout || beginCheckout.status === "MISSING") {
    return "begin_checkout event missing";
  }

  if (!addToCart || addToCart.status === "MISSING") {
    return "add_to_cart event missing";
  }

  if (!viewItem || viewItem.status === "MISSING") {
    return "view_item event missing";
  }

  if (
    purchase.status === "PARTIAL" ||
    beginCheckout.status === "PARTIAL" ||
    addToCart.status === "PARTIAL" ||
    viewItem.status === "PARTIAL"
  ) {
    return "payload quality needs review";
  }

  return "core GA4 funnel looks healthy";
}

// =========================================================
// MAIN BUILDER — GA4 FUNNEL
// =========================================================

export function buildGA4Funnel(ga4Audit: GA4EventAudit[]): GA4FunnelResult {
  // ------------------------------------------------------
  // 1) Read each target event from GA4 audit
  // ------------------------------------------------------
  const viewItemAudit = getEventAudit(ga4Audit, "view_item");
  const addToCartAudit = getEventAudit(ga4Audit, "add_to_cart");
  const beginCheckoutAudit = getEventAudit(ga4Audit, "begin_checkout");
  const purchaseAudit = getEventAudit(ga4Audit, "purchase");

  // ------------------------------------------------------
  // 2) Build normalized funnel steps
  // ------------------------------------------------------
  const steps: GA4FunnelStep[] = [
    {
      step: "view_item",
      detected: Boolean(viewItemAudit && viewItemAudit.count > 0),
      status: getStepStatus(viewItemAudit),
      count: viewItemAudit?.count || 0,
      payloadQualityScore: viewItemAudit?.payloadQualityScore || 0,
      criticalIssues: viewItemAudit?.criticalIssues || [],
    },
    {
      step: "add_to_cart",
      detected: Boolean(addToCartAudit && addToCartAudit.count > 0),
      status: getStepStatus(addToCartAudit),
      count: addToCartAudit?.count || 0,
      payloadQualityScore: addToCartAudit?.payloadQualityScore || 0,
      criticalIssues: addToCartAudit?.criticalIssues || [],
    },
    {
      step: "begin_checkout",
      detected: Boolean(beginCheckoutAudit && beginCheckoutAudit.count > 0),
      status: getStepStatus(beginCheckoutAudit),
      count: beginCheckoutAudit?.count || 0,
      payloadQualityScore: beginCheckoutAudit?.payloadQualityScore || 0,
      criticalIssues: beginCheckoutAudit?.criticalIssues || [],
    },
    {
      step: "purchase",
      detected: Boolean(purchaseAudit && purchaseAudit.count > 0),
      status: getStepStatus(purchaseAudit),
      count: purchaseAudit?.count || 0,
      payloadQualityScore: purchaseAudit?.payloadQualityScore || 0,
      criticalIssues: purchaseAudit?.criticalIssues || [],
    },
  ];

  // ------------------------------------------------------
  // 3) Score with business weighting
  // More weight on deeper funnel events
  // ------------------------------------------------------
  const viewItemScore = getStepScore(steps[0].status);
  const addToCartScore = getStepScore(steps[1].status);
  const beginCheckoutScore = getStepScore(steps[2].status);
  const purchaseScore = getStepScore(steps[3].status);

  const score = Math.round(
    viewItemScore * 0.2 +
      addToCartScore * 0.25 +
      beginCheckoutScore * 0.25 +
      purchaseScore * 0.3
  );

  // ------------------------------------------------------
  // 4) Main funnel risk
  // ------------------------------------------------------
  const mainRisk = getMainRisk(steps);

  // ------------------------------------------------------
  // 5) Final result
  // ------------------------------------------------------
  return {
    score,
    mainRisk,
    steps,
  };
}