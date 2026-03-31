import type {
  GoogleAdsAuditResult,
  GoogleAdsInsight,
} from "./ads.types";

export function buildGoogleAdsInsights(
  audit: GoogleAdsAuditResult
): GoogleAdsInsight[] {
  const insights: GoogleAdsInsight[] = [];

  if (!audit.detected) {
    return [
      {
        priority: "HIGH",
        title: "Google Ads tracking not detected",
        impact:
          "No Google Ads base tag, conversion label, or remarketing signal was found.",
        action:
          "Install the Google Ads base tag and configure at least one conversion.",
      },
    ];
  }

  if (audit.awIds.length > 0 && audit.conversionLabels.length === 0) {
    insights.push({
      priority: "HIGH",
      title: "Google Ads base tag detected but conversion labels missing",
      impact:
        "The site may load Google Ads, but no confirmed conversion mapping is visible.",
      action:
        "Configure conversion labels and validate runtime firing on key actions.",
    });
  }

  if (
    audit.awIds.length > 0 &&
    audit.conversionLabels.length > 0 &&
    audit.conversionEvents.length === 0
  ) {
    insights.push({
      priority: "MEDIUM",
      title: "Google Ads conversion mapping found but runtime event not observed",
      impact:
        "The setup looks present, but no runtime conversion event was captured during this scan.",
      action:
        "Test conversion paths such as add_to_cart, begin_checkout, or purchase.",
    });
  }

  if (
    audit.remarketingDetected &&
    audit.conversionLabels.length === 0
  ) {
    insights.push({
      priority: "MEDIUM",
      title: "Remarketing active but conversion tracking incomplete",
      impact:
        "Audiences may be built, but performance optimization remains limited without reliable conversions.",
      action:
        "Add and validate purchase or lead conversion tracking.",
    });
  }

  if (
    audit.status === "CONFIRMED" &&
    audit.awIds.length > 0 &&
    audit.conversionLabels.length > 0
  ) {
    insights.push({
      priority: "LOW",
      title: "Google Ads base tracking is operational",
      impact:
        "Google Ads IDs and conversion labels are present, which indicates a usable tracking setup.",
      action:
        audit.conversionEvents.length > 0
          ? "Maintain monitoring after GTM or checkout changes."
          : "Run runtime tests on conversion paths to confirm full execution.",
    });
  }

  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };

  return insights.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );
}