// =========================================================
// RUNTIME GLOBAL TYPES
// =========================================================

export type Status = "CONFIRMED" | "NOT_CONFIRMED" | "UNVERIFIED" | "PARTIAL";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type ValidationCheck = {
  check: string;
  status: Status;
  confidence: Confidence;
  evidence?: string;
  action?: string;
};

// =========================================================
// TIMELINE
// =========================================================

export type TimelineItem =
  | {
      ts: number;
      type: "request";
      name: string;
      url: string;
      method: string;
    }
  | {
      ts: number;
      type: "datalayer";
      name: string;
      payload: any;
    }
  | {
      ts: number;
      type: "note";
      name: string;
      payload?: any;
    }
  | {
      ts: number;
      type: "validation";
      name: string;
      payload: any;
    };

// =========================================================
// RUNTIME RESULT STRUCTURE
// =========================================================

export type RuntimeScanResult = {
  pagesVisited: string[];
  signals: any;
  validation: any;
  timeline: TimelineItem[];
  raw: any;
};

// =========================================================
// FINAL REPORT STRUCTURE
// =========================================================

export type RuntimeReport = {
  overallScore: number;
  categoryScores: Record<string, number>;
  validations: ValidationCheck[];
  executiveSummary: string;
  raw: any;
};