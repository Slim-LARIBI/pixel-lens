import type { GTMAuditResult } from "./gtm.types";

export function buildGTMAudit(gtmIds: string[]): GTMAuditResult {
  const detected = Array.isArray(gtmIds) && gtmIds.length > 0;

  return {
    detected,
    containerIds: gtmIds || [],
    status: detected ? "CONFIRMED" : "NOT_CONFIRMED",
    confidence: detected ? "HIGH" : "LOW",
    evidence: detected
      ? `Container(s): ${gtmIds.join(", ")}`
      : "No GTM script detected",
    action: detected
      ? "None"
      : "Install Google Tag Manager container on all pages",
  };
}