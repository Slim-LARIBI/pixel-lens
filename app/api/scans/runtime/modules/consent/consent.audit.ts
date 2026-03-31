import type { ConsentAuditResult } from "./consent.types";

function scoreClamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function buildConsentAudit(input: {
  consentSeen: boolean;
  cmpVendor?: string | null;
  cmpEvidence?: string[];
  consentModeDetected?: boolean;
  consentModeSignals?: string[];
  trackingBeforeConsentDetected?: boolean;
  preConsentSignals?: string[];
}): ConsentAuditResult {
  const cmpVendor = input?.cmpVendor || null;
  const cmpEvidence = Array.from(new Set((input?.cmpEvidence || []).filter(Boolean)));
  const consentModeDetected = Boolean(input?.consentModeDetected);
  const consentModeSignals = Array.from(
    new Set((input?.consentModeSignals || []).filter(Boolean))
  );
  const trackingBeforeConsentDetected = Boolean(input?.trackingBeforeConsentDetected);
  const preConsentSignals = Array.from(
    new Set((input?.preConsentSignals || []).filter(Boolean))
  );

  const detected = Boolean(input?.consentSeen || cmpVendor || cmpEvidence.length > 0);

  let score = 0;
  if (detected) score += 40;
  if (cmpVendor) score += 15;
  if (consentModeDetected) score += 30;
  if (!trackingBeforeConsentDetected && detected) score += 15;
  if (trackingBeforeConsentDetected) score -= 25;
  score = scoreClamp(score);

  let status: ConsentAuditResult["status"] = "UNVERIFIED";
  let confidence: ConsentAuditResult["confidence"] = "LOW";
  let evidence = "No clear consent implementation signal detected.";
  let action = "Implement a CMP and configure consent-aware tracking.";

  if (detected && consentModeDetected && !trackingBeforeConsentDetected) {
    status = "CONFIRMED";
    confidence = "HIGH";
    evidence = [
      cmpVendor ? `CMP: ${cmpVendor}` : "CMP detected",
      consentModeSignals.length > 0
        ? `Consent Mode signals: ${consentModeSignals.join(", ")}`
        : "Consent Mode detected",
      "No tracking before consent detected",
    ].join(" · ");
    action = "None";
  } else if (detected && (cmpVendor || consentModeDetected)) {
    status = "PARTIAL";
    confidence = consentModeDetected || cmpVendor ? "MEDIUM" : "LOW";
    evidence = [
      cmpVendor ? `CMP: ${cmpVendor}` : "Consent-related signal detected",
      consentModeDetected
        ? `Consent Mode signals: ${consentModeSignals.join(", ")}`
        : "Google Consent Mode not confirmed",
      trackingBeforeConsentDetected
        ? `Pre-consent tracking: ${preConsentSignals.join(", ")}`
        : "No pre-consent tracking detected",
    ]
      .filter(Boolean)
      .join(" · ");
    action =
      trackingBeforeConsentDetected
        ? "Review tag firing order and block tracking before consent."
        : "Validate Google Consent Mode and CMP behavior.";
  } else if (detected) {
    status = "PARTIAL";
    confidence = "LOW";
    evidence = cmpEvidence.length > 0 ? cmpEvidence.join(" · ") : "Consent signal detected";
    action = "Identify CMP vendor and validate Google Consent Mode.";
  } else {
    status = "NOT_CONFIRMED";
    confidence = "LOW";
  }

  return {
    detected,
    cmpVendor,
    cmpEvidence,
    consentModeDetected,
    consentModeSignals,
    trackingBeforeConsentDetected,
    preConsentSignals,
    status,
    confidence,
    evidence,
    action,
    score,
  };
}