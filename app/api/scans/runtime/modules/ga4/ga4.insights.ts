import type { GA4EventAudit, GA4Insight } from "./ga4.types";
import { buildGA4Funnel } from "./ga4.funnel";

// =========================================================
// GA4 MODULE — INSIGHTS ENGINE
// VERSION:
// - garde ta logique actuelle
// - ajoute begin_checkout
// - garde les règles business strictes
// - reste compatible avec le nouveau funnel 4 étapes
// =========================================================

export function buildGA4Insights(
  ga4Audit: GA4EventAudit[],
  ga4Funnel: ReturnType<typeof buildGA4Funnel>
) {
  const insights: GA4Insight[] = [];

  // ------------------------------------------------------
  // HELPERS — read funnel step
  // ------------------------------------------------------
  const getStep = (
    name: "view_item" | "add_to_cart" | "begin_checkout" | "purchase"
  ) => ga4Funnel.steps.find((s) => s.step === name);

  // ------------------------------------------------------
  // HELPERS — read audited event
  // ------------------------------------------------------
  const getEventAudit = (
    name: "view_item" | "add_to_cart" | "begin_checkout" | "purchase"
  ) => ga4Audit.find((e) => e.event === name);

  // ------------------------------------------------------
  // STEP REFERENCES
  // ------------------------------------------------------
  const viewItem = getStep("view_item");
  const addToCart = getStep("add_to_cart");
  const beginCheckout = getStep("begin_checkout");
  const purchase = getStep("purchase");

  // ------------------------------------------------------
  // AUDIT REFERENCES
  // ------------------------------------------------------
  const viewItemAudit = getEventAudit("view_item");
  const addToCartAudit = getEventAudit("add_to_cart");
  const beginCheckoutAudit = getEventAudit("begin_checkout");
  const purchaseAudit = getEventAudit("purchase");

  // ======================================================
  // 1) FUNNEL-LEVEL INSIGHTS
  // Missing deeper steps = higher business priority
  // ======================================================
  if (purchase?.status === "MISSING") {
    insights.push({
      priority: "HIGH",
      title: "purchase event missing",
      impact:
        "Revenue tracking is incomplete and GA4 ecommerce reporting may be unreliable.",
      action:
        "Validate purchase firing on the confirmation page and confirm transaction_id, value, currency, and items are sent.",
    });
  }

  if (beginCheckout?.status === "MISSING") {
    insights.push({
      priority: "HIGH",
      title: "begin_checkout event missing",
      impact:
        "Checkout entry is not measured, making the ecommerce funnel incomplete.",
      action:
        "Trigger begin_checkout when the user enters checkout or clicks the checkout CTA.",
    });
  }

  if (addToCart?.status === "MISSING") {
    insights.push({
      priority: "HIGH",
      title: "add_to_cart event missing",
      impact:
        "GA4 loses lower-funnel intent signals and ecommerce journey visibility becomes incomplete.",
      action:
        "Validate add_to_cart firing on product pages and cart interactions.",
    });
  }

  if (viewItem?.status === "MISSING") {
    insights.push({
      priority: "MEDIUM",
      title: "view_item event missing",
      impact:
        "Product detail engagement is incomplete, reducing GA4 ecommerce journey clarity.",
      action: "Validate view_item firing on product detail pages.",
    });
  }

  // ======================================================
  // 2) HARDER BUSINESS LOGIC
  // Your old strong logic, now extended with begin_checkout
  // ======================================================
  if (
    viewItemAudit?.count &&
    viewItemAudit.count > 0 &&
    (!addToCartAudit || addToCartAudit.count === 0)
  ) {
    insights.push({
      priority: "HIGH",
      title: "Users view items but no add_to_cart event",
      impact:
        "There is a major funnel gap between product interest and cart intent, reducing ecommerce analysis quality.",
      action:
        "Verify add_to_cart trigger, button interaction, and ecommerce payload.",
    });
  }

  if (
    addToCartAudit?.count &&
    addToCartAudit.count > 0 &&
    (!beginCheckoutAudit || beginCheckoutAudit.count === 0)
  ) {
    insights.push({
      priority: "HIGH",
      title: "add_to_cart without begin_checkout",
      impact:
        "Users add products to cart, but checkout entry is not measured, which breaks funnel visibility.",
      action:
        "Ensure begin_checkout fires when the user enters checkout or clicks the checkout button.",
    });
  }

  if (
    beginCheckoutAudit?.count &&
    beginCheckoutAudit.count > 0 &&
    (!purchaseAudit || purchaseAudit.count === 0)
  ) {
    insights.push({
      priority: "HIGH",
      title: "begin_checkout without purchase event",
      impact:
        "Users appear to reach checkout, but revenue is not tracked, which makes attribution incomplete.",
      action:
        "Implement purchase event with transaction_id, value, currency, and items on the confirmation page.",
    });
  }

  // ======================================================
  // 3) CROSS-EVENT CONSISTENCY INSIGHTS
  // Explains strange funnel situations
  // ======================================================
  if (purchase?.detected && !beginCheckout?.detected) {
    insights.push({
      priority: "MEDIUM",
      title: "purchase detected without begin_checkout",
      impact:
        "The GA4 ecommerce funnel is inconsistent and checkout progression cannot be analyzed properly.",
      action:
        "Review begin_checkout implementation so purchase is preceded by a checkout-entry step.",
    });
  }

  if (beginCheckout?.detected && !addToCart?.detected) {
    insights.push({
      priority: "MEDIUM",
      title: "begin_checkout detected without add_to_cart",
      impact:
        "Checkout activity is detected but cart intent is not visible, weakening funnel logic.",
      action:
        "Review add_to_cart implementation and cart interaction tracking.",
    });
  }

  if (addToCart?.detected && !viewItem?.detected) {
    insights.push({
      priority: "MEDIUM",
      title: "add_to_cart detected without view_item",
      impact:
        "GA4 receives cart intent signals but misses product view context, reducing funnel clarity.",
      action: "Review view_item implementation on product detail pages.",
    });
  }

  // ======================================================
  // 4) PAYLOAD-LEVEL INSIGHTS
  // Reads missing params and critical issues from audit
  // ======================================================
  for (const eventAudit of ga4Audit) {
    if (eventAudit.missingParams.length > 0) {
      insights.push({
        priority: "HIGH",
        title: `${eventAudit.event} missing required params`,
        impact:
          "GA4 may receive incomplete ecommerce data, which can degrade reporting quality and funnel accuracy.",
        action: `Add the missing params for ${eventAudit.event}: ${eventAudit.missingParams.join(", ")}.`,
      });
    }

    if (eventAudit.criticalIssues.length > 0) {
      insights.push({
        priority: "HIGH",
        title: `${eventAudit.event} has critical payload issues`,
        impact:
          "GA4 may process the event incorrectly or with reduced ecommerce data quality.",
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
          "The event is detected but payload quality is not fully optimal for GA4 ecommerce reporting.",
        action: `Review optional ecommerce params for ${eventAudit.event} and validate payload consistency.`,
      });
    }
  }

  // ======================================================
  // 5) PURCHASE-SPECIFIC HARD RULES
  // Most sensitive event in the funnel
  // ======================================================
  if (purchaseAudit) {
    const missingTransactionId = purchaseAudit.criticalIssues.some((issue) =>
      issue.toLowerCase().includes("transaction_id")
    );
    const missingValue = purchaseAudit.missingParams.includes("value");
    const missingCurrency = purchaseAudit.missingParams.includes("currency");
    const missingItems = purchaseAudit.missingParams.includes("items");

    if (missingTransactionId) {
      insights.push({
        priority: "HIGH",
        title: "purchase event missing transaction_id",
        impact:
          "GA4 may deduplicate purchases incorrectly or create unreliable transaction reporting.",
        action:
          "Send a stable transaction_id on purchase confirmation.",
      });
    }

    if (missingValue) {
      insights.push({
        priority: "HIGH",
        title: "purchase event missing value",
        impact:
          "Revenue reporting is incomplete and monetization analysis becomes unreliable.",
        action:
          "Send a valid numeric value in purchase.",
      });
    }

    if (missingCurrency) {
      insights.push({
        priority: "HIGH",
        title: "purchase event missing currency",
        impact:
          "Revenue reporting may be inconsistent across reports and destinations.",
        action:
          "Send a valid currency parameter in purchase.",
      });
    }

    if (missingItems) {
      insights.push({
        priority: "HIGH",
        title: "purchase event missing items",
        impact:
          "Product-level ecommerce analysis is incomplete, reducing reporting depth.",
        action:
          "Send the items array in purchase.",
      });
    }
  }

  // ======================================================
  // 6) BEGIN_CHECKOUT-SPECIFIC HARD RULES
  // Important middle-funnel event
  // ======================================================
  if (beginCheckoutAudit) {
    const missingValue = beginCheckoutAudit.missingParams.includes("value");
    const missingCurrency = beginCheckoutAudit.missingParams.includes("currency");
    const missingItems = beginCheckoutAudit.missingParams.includes("items");

    if (missingValue) {
      insights.push({
        priority: "MEDIUM",
        title: "begin_checkout event missing value",
        impact:
          "Checkout value cannot be analyzed correctly, reducing funnel quality.",
        action:
          "Send a valid numeric value in begin_checkout.",
      });
    }

    if (missingCurrency) {
      insights.push({
        priority: "MEDIUM",
        title: "begin_checkout event missing currency",
        impact:
          "Checkout value may be inconsistent across reports.",
        action:
          "Send a valid currency parameter in begin_checkout.",
      });
    }

    if (missingItems) {
      insights.push({
        priority: "MEDIUM",
        title: "begin_checkout event missing items",
        impact:
          "Checkout product-level analysis becomes incomplete.",
        action:
          "Send the items array in begin_checkout.",
      });
    }
  }

  // ======================================================
  // 7) POSITIVE SIGNAL
  // Only show healthy if all 4 core steps are good
  // ======================================================
  const strongCore =
    viewItem?.status === "OK" &&
    addToCart?.status === "OK" &&
    beginCheckout?.status === "OK" &&
    purchase?.status === "OK";

  if (strongCore) {
    insights.push({
      priority: "LOW",
      title: "Core GA4 ecommerce funnel is healthy",
      impact:
        "GA4 receives strong ecommerce signals across the main purchase journey.",
      action:
        "Maintain monitoring and validate this setup regularly after site changes.",
    });
  }

  // ======================================================
  // 8) FINAL SORT
  // ======================================================
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };

  return insights.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );
}