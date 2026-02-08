import { ScanProfile } from "@prisma/client";

export type FindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface Finding {
  id: string;
  severity: FindingSeverity;
  category: "GA4" | "GTM" | "META" | "CONSENT" | "CAPI";
  title: string;
  description: string;
  evidence: string;
  affectedSteps: string[];
  impact: {
    ads?: string;
    analytics?: string;
  };
  howToFix: string;
  codeSnippet?: string;
}

export interface EventData {
  type: "GA4" | "META" | "DATALAYER";
  name: string;
  timestamp: number;
  params?: Record<string, any>;
  issues?: string[];
}

export interface PageStep {
  page: string;
  url: string;
  events: EventData[];
  consentState?: {
    analytics: boolean;
    marketing: boolean;
  };
}

export interface CategoryScore {
  score: number;
  maxScore: number;
  status: "EXCELLENT" | "GOOD" | "NEEDS_WORK" | "CRITICAL";
}

export interface ScanResult {
  overallScore: number;
  categoryScores: {
    ga4: CategoryScore;
    gtm: CategoryScore;
    meta: CategoryScore;
    consent: CategoryScore;
    capi: CategoryScore;
  };
  executiveSummary: string;
  findings: Finding[];
  eventsTimeline: PageStep[];
  payloads: {
    ga4Events: any[];
    metaEvents: any[];
    dataLayerSnapshots: any[];
    consentSignals: any[];
  };
  raw: any;
}

export interface ScanOptions {
  url: string;
  profile: ScanProfile;
}
