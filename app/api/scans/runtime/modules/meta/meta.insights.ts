import type { MetaEventAudit, MetaInsight } from "./meta.types";
import { buildMetaFunnel } from "./meta.funnel";

// =========================================================
// META MODULE — INSIGHTS ENGINE
// Stricter business logic to avoid false "healthy" states
// =========================================================

export function buildMetaInsights(
  metaAudit: MetaEventAudit[],
  metaFunnel: ReturnType<typeof buildMetaFunnel>
) {
  const insights: MetaInsight[] = [];

  const getStep = (name: "ViewContent" | "AddToCart" | "Purchase") =>
    metaFunnel.steps.find((s) => s.step === name);

  const getEventAudit = (name: "ViewContent" | "AddToCart" | "Purchase") =>
    metaAudit.find((e) => e.event === name);

  const viewContent = getStep("ViewContent");
  const addToCart = getStep("AddToCart");
  const purchase = getStep("Purchase");

  const viewContentAudit = getEventAudit("ViewContent");
  const addToCartAudit = getEventAudit("AddToCart");
  const purchaseAudit = getEventAudit("Purchase");

  // ------------------------------------------------------
  // Funnel-level insights
  // ------------------------------------------------------
  if (purchase?.status === "MISSING") {
    insights.push({
      priority: "HIGH",
      title: "Purchase event missing",
      impact:
        "Revenue tracking is incomplete and ROAS reporting may be unreliable in Meta.",
      action:
        "Validate Purchase firing on the confirmation page and confirm value/currency are sent.",
    });
  }

  if (addToCart?.status === "MISSING") {
    insights.push({
      priority: "HIGH",
      title: "AddToCart event missing",
      impact:
        "Meta may lose key optimization signals for lower-funnel intent.",
      action:
        "Validate AddToCart firing on product pages and cart interactions.",
    });
  }

  if (viewContent?.status === "MISSING") {
    insights.push({
      priority: "MEDIUM",
      title: "ViewContent event missing",
      impact:
        "Product view signals are incomplete, which can reduce catalog and retargeting quality.",
      action: "Validate ViewContent firing on product detail pages.",
    });
  }

  // ------------------------------------------------------
  // Harder business logic
  // ------------------------------------------------------
  if (
    viewContentAudit?.count &&
    viewContentAudit.count > 0 &&
    (!addToCartAudit || addToCartAudit.count === 0)
  ) {
    insights.push({
      priority: "HIGH",
      title: "Users view products but no AddToCart is tracked",
      impact:
        "Meta sees product interest but loses the strongest lower-funnel intent signal before checkout.",
      action:
        "Fix AddToCart event firing and validate the add-to-cart button tracking immediately.",
    });
  }

  if (
    addToCartAudit?.count &&
    addToCartAudit.count > 0 &&
    (!purchaseAudit || purchaseAudit.count === 0)
  ) {
    insights.push({
      priority: "HIGH",
      title: "AddToCart detected but no Purchase tracked",
      impact:
        "Meta cannot optimize campaigns using final revenue outcomes, which weakens conversion quality and ROAS optimization.",
      action:
        "Validate Purchase event on the confirmation page and confirm value/currency are included.",
    });
  }

  // ------------------------------------------------------
  // Cross-event consistency insights
  // ------------------------------------------------------
  if (purchase?.detected && !addToCart?.detected) {
    insights.push({
      priority: "MEDIUM",
      title: "Purchase detected without AddToCart",
      impact:
        "The Meta funnel is inconsistent and lower-funnel behavior may be under-tracked.",
      action:
        "Review AddToCart implementation and confirm it fires before checkout steps.",
    });
  }

  if (addToCart?.detected && !viewContent?.detected) {
    insights.push({
      priority: "MEDIUM",
      title: "AddToCart detected without ViewContent",
      impact:
        "Meta receives cart intent signals but misses product view context, reducing funnel clarity.",
      action: "Review ViewContent implementation on product detail pages.",
    });
  }

  // ------------------------------------------------------
  // Payload-level insights
  // ------------------------------------------------------
  for (const eventAudit of metaAudit) {
    if (eventAudit.missingParams.length > 0) {
      insights.push({
        priority: "HIGH",
        title: `${eventAudit.event} missing required params`,
        impact:
          "Meta may receive incomplete ecommerce data, which can degrade attribution and optimization quality.",
        action: `Add the missing params for ${eventAudit.event}: ${eventAudit.missingParams.join(", ")}.`,
      });
    }

    if (eventAudit.criticalIssues.length > 0) {
      insights.push({
        priority: "HIGH",
        title: `${eventAudit.event} has critical payload issues`,
        impact:
          "Meta may process the event incorrectly or with reduced ecommerce signal quality.",
        action: `Fix the critical issues for ${eventAudit.event}: ${eventAudit.criticalIssues.join(", ")}.`,
      });
    }

    if (
      eventAudit.payloadQualityScore < 100 &&
      eventAudit.payloadQualityScore >= 60 &&
      eventAudit.criticalIssues.length === 0 &&
      eventAudit.missingParams.length === 0
    ) {
      insights.push({
        priority: "MEDIUM",
        title: `${eventAudit.event} payload quality needs review`,
        impact:
          "The event is detected but payload quality is not fully optimal.",
        action: `Review optional ecommerce params for ${eventAudit.event} and validate payload consistency.`,
      });
    }
  }

  // ------------------------------------------------------
  // Purchase-specific hard rules
  // ------------------------------------------------------
  if (purchaseAudit) {
    const hasMissingValue = purchaseAudit.missingParams.includes("value");
    const hasMissingCurrency = purchaseAudit.missingParams.includes("currency");
    const hasBadValueIssue = purchaseAudit.criticalIssues.some((issue) =>
      issue.toLowerCase().includes("value")
    );

    if (hasMissingValue || hasBadValueIssue) {
      insights.push({
        priority: "HIGH",
        title: "Purchase event value is missing or invalid",
        impact:
          "Meta cannot optimize based on revenue correctly, making ROAS reporting unreliable.",
        action:
          "Send a valid numeric value parameter in Purchase and confirm it is greater than 0.",
      });
    }

    if (hasMissingCurrency) {
      insights.push({
        priority: "HIGH",
        title: "Purchase event currency is missing",
        impact:
          "Revenue data quality is incomplete, which can affect purchase reporting and optimization.",
        action:
          "Send a valid currency parameter in Purchase (for example TND, EUR, USD).",
      });
    }
  }

  // ------------------------------------------------------
  // Positive signal
  // ------------------------------------------------------
  const strongCore =
    viewContent?.status === "OK" &&
    addToCart?.status === "OK" &&
    purchase?.status === "OK";

  if (strongCore) {
    insights.push({
      priority: "LOW",
      title: "Core Meta ecommerce funnel is healthy",
      impact:
        "Meta receives strong lower-funnel signals across the main ecommerce journey.",
      action:
        "Maintain monitoring and validate this setup regularly after site changes.",
    });
  }

  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };

  return insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}