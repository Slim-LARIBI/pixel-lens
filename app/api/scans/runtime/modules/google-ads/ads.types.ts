export type GoogleAdsSignalRecord = {
  awIds: string[];
  conversionLabels: string[];
  conversionEvents: string[];
  remarketingDetected: boolean;
};

export type GoogleAdsAuditResult = {
  detected: boolean;
  awIds: string[];
  conversionLabels: string[];
  conversionEvents: string[];
  remarketingDetected: boolean;
  status: "CONFIRMED" | "PARTIAL" | "NOT_CONFIRMED";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidence: string;
  action: string;
};

export type GoogleAdsInsight = {
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  impact: string;
  action: string;
};