import type { MetaEventAudit, MetaPayloadRecord } from "./meta.types";

import {
  getNumericValue,
  hasMeaningfulValue,
  isNonEmptyString,
  isNumericLike,
} from "../../shared/validation.utils";
// =========================================================
// META MODULE — NORMALIZATION
// =========================================================

function normalizeMetaEventName(eventName: string) {
  const e = String(eventName || "").trim();
  if (!e) return "";

  const mapping: Record<string, string> = {
    ViewContent: "ViewContent",
    AddToCart: "AddToCart",
    InitiateCheckout: "InitiateCheckout",
    Purchase: "Purchase",
    PageView: "PageView",
    Lead: "Lead",
    CompleteRegistration: "CompleteRegistration",
  };

  return mapping[e] || e;
}

function getMetaRequiredParams(eventName: string) {
  switch (eventName) {
    case "ViewContent":
      return ["content_ids", "content_type"];
    case "AddToCart":
      return ["content_ids", "content_type", "value", "currency"];
    case "Purchase":
      return ["value", "currency"];
    case "InitiateCheckout":
      return ["value", "currency"];
    default:
      return [];
  }
}

// =========================================================
// META MODULE — CRITICAL ISSUES
// =========================================================

function buildMetaCriticalIssues(eventName: string, samples: MetaPayloadRecord[]) {
  const issues = new Set<string>();

  for (const sample of samples) {
    const params = sample?.params || {};

    if (
      ["ViewContent", "AddToCart"].includes(eventName) &&
      !hasMeaningfulValue(params.content_ids)
    ) {
      issues.add("content_ids missing");
    }

    if (
      ["ViewContent", "AddToCart"].includes(eventName) &&
      hasMeaningfulValue(params.content_ids) &&
      !Array.isArray(params.content_ids)
    ) {
      issues.add("content_ids should be an array");
    }

    if (
      ["ViewContent", "AddToCart"].includes(eventName) &&
      !hasMeaningfulValue(params.content_type)
    ) {
      issues.add("content_type missing");
    }

    if (
      ["AddToCart", "InitiateCheckout", "Purchase"].includes(eventName) &&
      !hasMeaningfulValue(params.currency)
    ) {
      issues.add("currency missing");
    }

    if (
      ["AddToCart", "InitiateCheckout", "Purchase"].includes(eventName) &&
      hasMeaningfulValue(params.currency) &&
      !isNonEmptyString(params.currency)
    ) {
      issues.add("currency should be a string");
    }

    if (
      ["AddToCart", "InitiateCheckout", "Purchase"].includes(eventName) &&
      !hasMeaningfulValue(params.value)
    ) {
      issues.add("value missing");
    }

    if (
      ["AddToCart", "InitiateCheckout", "Purchase"].includes(eventName) &&
      hasMeaningfulValue(params.value) &&
      !isNumericLike(params.value)
    ) {
      issues.add("value should be numeric");
    }

    if (
      ["AddToCart", "InitiateCheckout", "Purchase"].includes(eventName) &&
      isNumericLike(params.value) &&
      getNumericValue(params.value) <= 0
    ) {
      issues.add("value should be greater than 0");
    }

    if (
      eventName === "Purchase" &&
      !hasMeaningfulValue(params.contents) &&
      !hasMeaningfulValue(params.content_ids)
    ) {
      issues.add("purchase should contain contents or content_ids");
    }

    if (
      hasMeaningfulValue(params.contents) &&
      !Array.isArray(params.contents)
    ) {
      issues.add("contents should be an array");
    }
  }

  return Array.from(issues);
}

// =========================================================
// META MODULE — EVENT AUDIT
// =========================================================

export function buildMetaAudit(metaPayloads: MetaPayloadRecord[]) {
  const grouped = new Map<string, MetaPayloadRecord[]>();

  for (const entry of metaPayloads || []) {
    const normalizedEvent = normalizeMetaEventName(String(entry?.event || ""));
    if (!normalizedEvent) continue;

    if (!["ViewContent", "AddToCart", "Purchase"].includes(normalizedEvent)) {
      continue;
    }

    if (!grouped.has(normalizedEvent)) {
      grouped.set(normalizedEvent, []);
    }

    grouped.get(normalizedEvent)!.push(entry);
  }

  const audits: MetaEventAudit[] = [];

  for (const [event, items] of grouped.entries()) {
    const requiredParams = getMetaRequiredParams(event);

    const paramSet = new Set<string>();
    for (const item of items) {
      const params = item?.params || {};
      for (const key of Object.keys(params)) {
        if (hasMeaningfulValue(params[key])) {
          paramSet.add(key);
        }
      }
    }

    const presentParams = Array.from(paramSet).sort();
    const missingParams = requiredParams.filter((p) => !paramSet.has(p));
    const criticalIssues = buildMetaCriticalIssues(event, items);

    const matchedRequiredCount = presentParams.filter((p) =>
      requiredParams.includes(p)
    ).length;

    let payloadQualityScore =
      requiredParams.length === 0
        ? 100
        : Math.round((matchedRequiredCount / requiredParams.length) * 100);

    if (criticalIssues.length > 0) {
      payloadQualityScore = Math.max(0, payloadQualityScore - criticalIssues.length * 15);
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
        params: x.params || {},
        ts: x.ts || null,
      })),
    });
  }

  const preferredOrder = ["ViewContent", "AddToCart", "Purchase"];

  return audits.sort(
    (a, b) => preferredOrder.indexOf(a.event) - preferredOrder.indexOf(b.event)
  );
}