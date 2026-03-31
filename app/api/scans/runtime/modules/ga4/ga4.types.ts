// =========================================================
// GA4 MODULE — CORE TYPES
// Shared types used by:
// - ga4.audit.ts
// - ga4.funnel.ts
// - ga4.insights.ts
// =========================================================

// ---------------------------------------------------------
// Raw GA4 payload captured by runtime scan
// ---------------------------------------------------------
export type GA4PayloadRecord = {
  event?: string;
  params?: Record<string, any>;
  ts?: number;
  source?: string;
};

// ---------------------------------------------------------
// Audited GA4 event
// Example:
// - view_item
// - add_to_cart
// - begin_checkout
// - purchase
// ---------------------------------------------------------
export type GA4EventAudit = {
  event: string;
  count: number;
  requiredParams: string[];
  presentParams: string[];
  missingParams: string[];
  payloadQualityScore: number;
  criticalIssues: string[];
  samples: Array<{
    params: Record<string, any>;
    ts: number | null;
  }>;
};

// ---------------------------------------------------------
// Funnel step used in ga4.funnel.ts
// ---------------------------------------------------------
export type GA4FunnelStep = {
  step: "view_item" | "add_to_cart" | "begin_checkout" | "purchase";
  detected: boolean;
  status: "OK" | "PARTIAL" | "MISSING";
  count: number;
  payloadQualityScore: number;
  criticalIssues: string[];
};

// ---------------------------------------------------------
// Funnel result used by UI + runtime report
// ---------------------------------------------------------
export type GA4FunnelResult = {
  score: number;
  mainRisk: string;
  steps: GA4FunnelStep[];
};

// ---------------------------------------------------------
// Insight type used in ga4.insights.ts
// ---------------------------------------------------------
export type GA4Insight = {
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  impact: string;
  action: string;
};