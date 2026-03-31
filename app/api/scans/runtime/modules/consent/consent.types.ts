export type ConsentAuditResult = {
  detected: boolean;
  cmpVendor: string | null;
  cmpEvidence: string[];
  consentModeDetected: boolean;
  consentModeSignals: string[];
  trackingBeforeConsentDetected: boolean;
  preConsentSignals: string[];
  status: "CONFIRMED" | "PARTIAL" | "NOT_CONFIRMED" | "UNVERIFIED";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidence: string;
  action: string;
  score: number;
};

export type ConsentInsight = {
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  impact: string;
  action: string;
};