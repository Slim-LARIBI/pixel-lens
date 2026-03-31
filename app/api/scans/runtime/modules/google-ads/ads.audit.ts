import type {
  GoogleAdsAuditResult,
  GoogleAdsSignalRecord,
} from "./ads.types";

function uniq(arr: string[]) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

export function buildGoogleAdsAudit(
  signals: GoogleAdsSignalRecord
): GoogleAdsAuditResult {
  const awIds = uniq(signals?.awIds || []);
  const conversionLabels = uniq(signals?.conversionLabels || []);
  const conversionEvents = uniq(signals?.conversionEvents || []);
  const remarketingDetected = Boolean(signals?.remarketingDetected);

  const detected =
    awIds.length > 0 ||
    conversionLabels.length > 0 ||
    conversionEvents.length > 0 ||
    remarketingDetected;

  let status: GoogleAdsAuditResult["status"] = "NOT_CONFIRMED";
  let confidence: GoogleAdsAuditResult["confidence"] = "LOW";
  let evidence = "No Google Ads conversion or remarketing signal detected.";
  let action = "Verify Google Ads base tag, conversion linker, and conversion firing.";

  // ---------------------------------------------------------
  // CONFIRMED
  // Realistic logic:
  // - base tag + conversion labels = enough to confirm setup
  // - conversion events / remarketing increase confidence of health
  // ---------------------------------------------------------
  if (awIds.length > 0 && conversionLabels.length > 0) {
    status = "CONFIRMED";
    confidence =
      conversionEvents.length > 0 || remarketingDetected ? "HIGH" : "MEDIUM";

    evidence = [
      awIds.length > 0 ? `AW IDs: ${awIds.join(", ")}` : "",
      conversionLabels.length > 0
        ? `Conversion labels: ${conversionLabels.join(", ")}`
        : "",
      conversionEvents.length > 0
        ? `Conversion events: ${conversionEvents.join(", ")}`
        : "",
      remarketingDetected ? "Remarketing signal detected" : "",
    ]
      .filter(Boolean)
      .join(" · ");

    action =
      conversionEvents.length > 0
        ? "None"
        : "Validate that at least one Google Ads conversion event fires at runtime.";
  }
  // ---------------------------------------------------------
  // PARTIAL
  // ---------------------------------------------------------
  else if (
    awIds.length > 0 ||
    remarketingDetected ||
    conversionLabels.length > 0 ||
    conversionEvents.length > 0
  ) {
    status = "PARTIAL";
    confidence =
      awIds.length > 0 || conversionLabels.length > 0 ? "MEDIUM" : "LOW";

    evidence = [
      awIds.length > 0 ? `AW IDs: ${awIds.join(", ")}` : "",
      conversionLabels.length > 0
        ? `Conversion labels: ${conversionLabels.join(", ")}`
        : "",
      conversionEvents.length > 0
        ? `Conversion events: ${conversionEvents.join(", ")}`
        : "",
      remarketingDetected ? "Remarketing signal detected" : "",
    ]
      .filter(Boolean)
      .join(" · ");

    action =
      "Validate Google Ads conversion labels and confirm a runtime conversion fires correctly.";
  }

  return {
    detected,
    awIds,
    conversionLabels,
    conversionEvents,
    remarketingDetected,
    status,
    confidence,
    evidence,
    action,
  };
}