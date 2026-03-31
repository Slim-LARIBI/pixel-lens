import type { MetaEventAudit, MetaFunnelStep } from "./meta.types";

// =========================================================
// META MODULE — FUNNEL ENGINE
// =========================================================

export function buildMetaFunnel(metaAudit: MetaEventAudit[]) {
  const getEvent = (name: string) =>
    metaAudit.find((item) => item.event === name);

  const viewContent = getEvent("ViewContent");
  const addToCart = getEvent("AddToCart");
  const purchase = getEvent("Purchase");

  const steps: MetaFunnelStep[] = [
    {
      step: "ViewContent",
      detected: !!viewContent,
      count: viewContent?.count || 0,
      payloadQualityScore: viewContent?.payloadQualityScore || 0,
      criticalIssues: viewContent?.criticalIssues || [],
      status: !viewContent
        ? "MISSING"
        : viewContent.payloadQualityScore >= 80 &&
          (viewContent.criticalIssues?.length || 0) === 0
        ? "OK"
        : "PARTIAL",
    },
    {
      step: "AddToCart",
      detected: !!addToCart,
      count: addToCart?.count || 0,
      payloadQualityScore: addToCart?.payloadQualityScore || 0,
      criticalIssues: addToCart?.criticalIssues || [],
      status: !addToCart
        ? "MISSING"
        : addToCart.payloadQualityScore >= 80 &&
          (addToCart.criticalIssues?.length || 0) === 0
        ? "OK"
        : "PARTIAL",
    },
    {
      step: "Purchase",
      detected: !!purchase,
      count: purchase?.count || 0,
      payloadQualityScore: purchase?.payloadQualityScore || 0,
      criticalIssues: purchase?.criticalIssues || [],
      status: !purchase
        ? "MISSING"
        : purchase.payloadQualityScore >= 80 &&
          (purchase.criticalIssues?.length || 0) === 0
        ? "OK"
        : "PARTIAL",
    },
  ];

  let score = 0;
  for (const step of steps) {
    if (step.status === "OK") score += 100 / 3;
    else if (step.status === "PARTIAL") score += 50 / 3;
  }

  const roundedScore = Math.round(score);

  let mainRisk = "No major Meta funnel risk detected";
  if (steps.find((s) => s.step === "Purchase" && s.status === "MISSING")) {
    mainRisk = "Purchase event missing";
  } else if (steps.find((s) => s.step === "AddToCart" && s.status === "MISSING")) {
    mainRisk = "AddToCart event missing";
  } else if (steps.find((s) => s.step === "ViewContent" && s.status === "MISSING")) {
    mainRisk = "ViewContent event missing";
  } else {
    const partial = steps.find((s) => s.status === "PARTIAL");
    if (partial) {
      mainRisk = `${partial.step} payload quality needs review`;
    }
  }

  return {
    score: roundedScore,
    mainRisk,
    steps,
  };
}