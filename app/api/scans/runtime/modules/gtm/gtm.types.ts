export type GTMAuditResult = {
  detected: boolean;
  containerIds: string[];
  status: "CONFIRMED" | "NOT_CONFIRMED";
  confidence: "HIGH" | "LOW";
  evidence: string;
  action: string;
};