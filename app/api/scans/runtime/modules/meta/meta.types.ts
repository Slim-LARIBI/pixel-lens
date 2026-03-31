export type MetaPayloadRecord = {
  cmd?: string;
  event?: string;
  params?: Record<string, any>;
  ts?: number;
};

export type MetaEventAudit = {
  event: string;
  count: number;
  requiredParams: string[];
  presentParams: string[];
  missingParams: string[];
  payloadQualityScore: number;
  criticalIssues: string[];
  samples: Array<Record<string, any>>;
};

export type MetaFunnelStep = {
  step: "ViewContent" | "AddToCart" | "Purchase";
  detected: boolean;
  count: number;
  payloadQualityScore: number;
  criticalIssues: string[];
  status: "OK" | "PARTIAL" | "MISSING";
};

export type MetaInsight = {
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  impact: string;
  action: string;
};