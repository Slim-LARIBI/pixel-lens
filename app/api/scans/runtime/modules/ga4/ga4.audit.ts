import type { GA4EventAudit, GA4PayloadRecord } from "./ga4.types";

import {
  getNumericValue,
  hasMeaningfulValue,
  isNonEmptyString,
  isNumericLike,
} from "../../shared/validation.utils";

// =========================================================
// GA4 MODULE — NORMALIZATION
// =========================================================

function normalizeGA4EventName(eventName: string) {
  return String(eventName || "").trim().toLowerCase();
}

// =========================================================
// HELPERS — ITEM EXTRACTION
// Goal:
// support multiple ecommerce payload shapes:
//
// Modern GA4:
// {
//   items: [...]
//
// or
// {
//   ecommerce: { items: [...] }
// }
//
// Legacy / Enhanced Ecommerce style:
// {
//   ecommerce: {
//     detail: { products: [...] }
//   }
// }
//
// Other fallbacks:
// {
//   products: [...]
// }
// =========================================================

function extractNormalizedItems(params: Record<string, any>) {
  const p = params || {};
  const ecommerce = p.ecommerce && typeof p.ecommerce === "object" ? p.ecommerce : {};

  if (Array.isArray(p.items) && p.items.length > 0) {
    return p.items;
  }

  if (Array.isArray(ecommerce.items) && ecommerce.items.length > 0) {
    return ecommerce.items;
  }

  if (Array.isArray(p.products) && p.products.length > 0) {
    return p.products;
  }

  if (Array.isArray(ecommerce.products) && ecommerce.products.length > 0) {
    return ecommerce.products;
  }

  if (
    ecommerce.detail &&
    typeof ecommerce.detail === "object" &&
    Array.isArray(ecommerce.detail.products) &&
    ecommerce.detail.products.length > 0
  ) {
    return ecommerce.detail.products;
  }

  if (
    ecommerce.add &&
    typeof ecommerce.add === "object" &&
    Array.isArray(ecommerce.add.products) &&
    ecommerce.add.products.length > 0
  ) {
    return ecommerce.add.products;
  }

  if (
    ecommerce.checkout &&
    typeof ecommerce.checkout === "object" &&
    Array.isArray(ecommerce.checkout.products) &&
    ecommerce.checkout.products.length > 0
  ) {
    return ecommerce.checkout.products;
  }

  if (
    ecommerce.purchase &&
    typeof ecommerce.purchase === "object" &&
    Array.isArray(ecommerce.purchase.products) &&
    ecommerce.purchase.products.length > 0
  ) {
    return ecommerce.purchase.products;
  }

  return undefined;
}

// =========================================================
// HELPERS — VALUE EXTRACTION
// =========================================================

function extractCurrency(params: Record<string, any>, items: any[] | undefined) {
  const p = params || {};
  const ecommerce = p.ecommerce && typeof p.ecommerce === "object" ? p.ecommerce : {};
  const firstItem = Array.isArray(items) && items.length > 0 ? items[0] : null;

  if (hasMeaningfulValue(p.currency)) return p.currency;
  if (hasMeaningfulValue(ecommerce.currency)) return ecommerce.currency;
  if (hasMeaningfulValue(ecommerce.currencyCode)) return ecommerce.currencyCode;
  if (hasMeaningfulValue(firstItem?.currency)) return firstItem.currency;

  return undefined;
}

function extractValue(params: Record<string, any>, items: any[] | undefined) {
  const p = params || {};
  const ecommerce = p.ecommerce && typeof p.ecommerce === "object" ? p.ecommerce : {};
  const firstItem = Array.isArray(items) && items.length > 0 ? items[0] : null;

  if (hasMeaningfulValue(p.value)) return p.value;
  if (hasMeaningfulValue(ecommerce.value)) return ecommerce.value;
  if (hasMeaningfulValue(ecommerce.revenue)) return ecommerce.revenue;
  if (hasMeaningfulValue(ecommerce.total)) return ecommerce.total;
  if (hasMeaningfulValue(firstItem?.price)) return firstItem.price;

  return undefined;
}

function extractTransactionId(params: Record<string, any>) {
  const p = params || {};
  const ecommerce = p.ecommerce && typeof p.ecommerce === "object" ? p.ecommerce : {};
  const purchase =
    ecommerce.purchase && typeof ecommerce.purchase === "object"
      ? ecommerce.purchase
      : {};

  if (hasMeaningfulValue(p.transaction_id)) return p.transaction_id;
  if (hasMeaningfulValue(p.transactionId)) return p.transactionId;
  if (hasMeaningfulValue(ecommerce.transaction_id)) return ecommerce.transaction_id;
  if (hasMeaningfulValue(ecommerce.transactionId)) return ecommerce.transactionId;
  if (hasMeaningfulValue(purchase.actionField?.id)) return purchase.actionField.id;
  if (hasMeaningfulValue(purchase.id)) return purchase.id;

  return undefined;
}

// =========================================================
// MAIN PARAM NORMALIZER
// Important:
// this is the key fix for view_item false negatives.
// =========================================================

function normalizeGA4Params(params: Record<string, any>) {
  const p = params || {};
  const ecommerce = p.ecommerce && typeof p.ecommerce === "object" ? p.ecommerce : {};

  const items = extractNormalizedItems(p);

  const normalized = {
    ...p,
    items,
    currency: extractCurrency(p, items),
    value: extractValue(p, items),
    transaction_id: extractTransactionId(p),

    // keep ecommerce object too for debug / UI sample payloads
    ecommerce,
  };

  return normalized;
}

// =========================================================
// REQUIRED PARAMS
// =========================================================

function getGA4RequiredParams(eventName: string) {
  switch (eventName) {
    case "view_item":
      return ["items"];
    case "add_to_cart":
      return ["items", "currency", "value"];
    case "begin_checkout":
      return ["items"];
    case "purchase":
      return ["items", "currency", "value", "transaction_id"];
    default:
      return [];
  }
}

// =========================================================
// CRITICAL ISSUES
// =========================================================

function buildGA4CriticalIssues(eventName: string, samples: GA4PayloadRecord[]) {
  const issues = new Set<string>();

  for (const sample of samples) {
    const params = normalizeGA4Params(sample?.params || {});

    if (
      ["view_item", "add_to_cart", "begin_checkout", "purchase"].includes(eventName) &&
      !hasMeaningfulValue(params.items)
    ) {
      issues.add("items missing");
    }

    if (
      ["view_item", "add_to_cart", "begin_checkout", "purchase"].includes(eventName) &&
      hasMeaningfulValue(params.items) &&
      !Array.isArray(params.items)
    ) {
      issues.add("items should be an array");
    }

    if (
      ["add_to_cart", "purchase"].includes(eventName) &&
      !hasMeaningfulValue(params.currency)
    ) {
      issues.add("currency missing");
    }

    if (
      ["add_to_cart", "purchase"].includes(eventName) &&
      hasMeaningfulValue(params.currency) &&
      !isNonEmptyString(params.currency)
    ) {
      issues.add("currency should be a string");
    }

    if (
      ["add_to_cart", "purchase"].includes(eventName) &&
      !hasMeaningfulValue(params.value)
    ) {
      issues.add("value missing");
    }

    if (
      ["add_to_cart", "purchase"].includes(eventName) &&
      hasMeaningfulValue(params.value) &&
      !isNumericLike(params.value)
    ) {
      issues.add("value should be numeric");
    }

    if (
      ["add_to_cart", "purchase"].includes(eventName) &&
      isNumericLike(params.value) &&
      getNumericValue(params.value) <= 0
    ) {
      issues.add("value should be greater than 0");
    }

    if (eventName === "purchase" && !hasMeaningfulValue(params.transaction_id)) {
      issues.add("transaction_id missing");
    }
  }

  return Array.from(issues);
}

// =========================================================
// EVENT AUDIT
// =========================================================

export function buildGA4Audit(ga4Payloads: GA4PayloadRecord[]) {
  const grouped = new Map<string, GA4PayloadRecord[]>();

  for (const entry of ga4Payloads || []) {
    const normalizedEvent = normalizeGA4EventName(String(entry?.event || ""));
    if (!normalizedEvent) continue;

    if (!["view_item", "add_to_cart", "begin_checkout", "purchase"].includes(normalizedEvent)) {
      continue;
    }

    if (!grouped.has(normalizedEvent)) {
      grouped.set(normalizedEvent, []);
    }

    grouped.get(normalizedEvent)!.push({
      ...entry,
      params: normalizeGA4Params(entry?.params || {}),
    });
  }

  const audits: GA4EventAudit[] = [];

  for (const [event, items] of grouped.entries()) {
    const requiredParams = getGA4RequiredParams(event);

    const paramSet = new Set<string>();

    for (const item of items) {
      const params = normalizeGA4Params(item?.params || {});

      for (const key of Object.keys(params)) {
        if (hasMeaningfulValue(params[key])) {
          paramSet.add(key);
        }
      }
    }

    const presentParams = Array.from(paramSet).sort();
    const missingParams = requiredParams.filter((p) => !paramSet.has(p));
    const criticalIssues = buildGA4CriticalIssues(event, items);

    const matchedRequiredCount = presentParams.filter((p) =>
      requiredParams.includes(p)
    ).length;

    let payloadQualityScore =
      requiredParams.length === 0
        ? 100
        : Math.round((matchedRequiredCount / requiredParams.length) * 100);

    if (criticalIssues.length > 0) {
      payloadQualityScore = Math.max(
        0,
        payloadQualityScore - criticalIssues.length * 15
      );
    }

    audits.push({
      event,
      count: items.length,
      requiredParams,
      presentParams,
      missingParams,
      payloadQualityScore,
      criticalIssues,
      samples: items.slice(0, 3).map((x) => ({
        params: normalizeGA4Params(x.params || {}),
        ts: x.ts || null,
      })),
    });
  }

  const preferredOrder = ["view_item", "add_to_cart", "begin_checkout", "purchase"];

  return audits.sort(
    (a, b) => preferredOrder.indexOf(a.event) - preferredOrder.indexOf(b.event)
  );
}