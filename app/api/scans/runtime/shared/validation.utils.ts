// =========================================================
// SHARED VALIDATION UTILS
// Reusable across Meta / GA4 / Ads / GTM modules
// =========================================================

export function hasMeaningfulValue(value: any) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

export function isNumericLike(value: any) {
  if (typeof value === "number") return !Number.isNaN(value);
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    !Number.isNaN(Number(value))
  ) {
    return true;
  }
  return false;
}

export function getNumericValue(value: any) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return NaN;
}

export function isNonEmptyString(value: any) {
  return typeof value === "string" && value.trim() !== "";
}