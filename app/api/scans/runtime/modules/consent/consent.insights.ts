import type { ConsentAuditResult, ConsentInsight } from "./consent.types";

export function buildConsentInsights(audit: ConsentAuditResult): ConsentInsight[] {
  const insights: ConsentInsight[] = [];

  if (!audit.detected) {
    return [
      {
        priority: "HIGH",
        title: "Consent layer not clearly detected",
        impact:
          "Privacy controls may be missing or not observable, which can weaken consent governance.",
        action:
          "Install a CMP and validate consent-aware behavior for analytics and ads tags.",
      },
    ];
  }

  if (audit.detected && !audit.consentModeDetected) {
    insights.push({
      priority: "HIGH",
      title: "CMP detected but Google Consent Mode not confirmed",
      impact:
        "Google tags may not receive explicit consent states, reducing privacy control and modelling quality.",
      action:
        "Implement gtag consent default/update with analytics_storage and ad_storage signals.",
    });
  }

  if (audit.trackingBeforeConsentDetected) {
    insights.push({
      priority: "HIGH",
      title: "Tracking detected before consent",
      impact:
        "Analytics or ad tags may fire before user consent, creating potential compliance risk.",
      action:
        "Block tracking until CMP consent state is resolved and verify trigger sequencing.",
    });
  }

  if (
    audit.detected &&
    audit.consentModeDetected &&
    !audit.trackingBeforeConsentDetected
  ) {
    insights.push({
      priority: "LOW",
      title: "Consent setup appears healthy",
      impact:
        "CMP and consent-aware tracking signals are both visible, which suggests stronger privacy handling.",
      action:
        "Maintain monitoring after any GTM, CMP, or checkout changes.",
    });
  }

  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}