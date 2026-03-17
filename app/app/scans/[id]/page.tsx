import { notFound } from "next/navigation";
import ScanTabs from "@/components/scan-tabs";
import ScanTimeline from "@/components/scan-timeline";
import EcommerceFunnel from "@/components/ecommerce-funnel";
import TrackingGraph from "@/components/tracking-graph";
import Link from "next/link";
import { db } from "@/lib/db";

type Status = "CONFIRMED" | "NOT_CONFIRMED" | "UNVERIFIED" | "PARTIAL";
type Confidence = "HIGH" | "MEDIUM" | "LOW";

type ValidationCheck = {
  check: string;
  status: Status;
  confidence: Confidence;
  evidence?: string;
  action?: string;
};

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function Badge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function statusBadge(status: Status) {
  if (status === "CONFIRMED") {
    return (
      <Badge className="border-green-200 bg-green-50 text-green-700">
        Confirmed
      </Badge>
    );
  }
  if (status === "PARTIAL") {
    return (
      <Badge className="border-yellow-200 bg-yellow-50 text-yellow-700">
        Partial
      </Badge>
    );
  }
  if (status === "NOT_CONFIRMED") {
    return (
      <Badge className="border-orange-200 bg-orange-50 text-orange-700">
        Not confirmed
      </Badge>
    );
  }
  return (
    <Badge className="border-slate-200 bg-slate-50 text-slate-700">
      Unverified
    </Badge>
  );
}

function confidenceBadge(confidence: Confidence) {
  if (confidence === "HIGH") {
    return (
      <Badge className="border-green-200 bg-green-50 text-green-700">
        High
      </Badge>
    );
  }
  if (confidence === "MEDIUM") {
    return (
      <Badge className="border-yellow-200 bg-yellow-50 text-yellow-700">
        Medium
      </Badge>
    );
  }
  return (
    <Badge className="border-slate-200 bg-slate-50 text-slate-700">Low</Badge>
  );
}

function scoreToConfidence(score: number): Confidence {
  if (score >= 75) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
}

function getCheckByName(checks: ValidationCheck[], name: string): ValidationCheck {
  return (
    checks.find((c) => c.check.toLowerCase() === name.toLowerCase()) || {
      check: name,
      status: "UNVERIFIED",
      confidence: "LOW",
      evidence: "No direct evidence",
      action: "Review manually",
    }
  );
}

function getMainRisk(checks: ValidationCheck[]) {
  const risky =
    checks.find((c) => c.status === "NOT_CONFIRMED") ||
    checks.find((c) => c.status === "PARTIAL") ||
    checks.find((c) => c.status === "UNVERIFIED");

  return risky?.check || "No major risk detected";
}

function ProgressBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
      <div
        className="h-2 rounded-full bg-slate-900 transition-all duration-500"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4">
      <div className="text-base font-semibold">{title}</div>
      {subtitle ? (
        <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
      ) : null}
    </div>
  );
}

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const scan = await db.scan.findUnique({
    where: { id },
    include: { workspace: true, shareLinks: true },
  });

  if (!scan) notFound();

  const overallScore = scan.overallScore ?? 0;

  const categoryScores = safeJsonParse<Record<string, number>>(
    scan.categoryScores,
    {}
  );

  const timeline = safeJsonParse<any[]>(scan.eventsTimeline, []);
  const raw = safeJsonParse<any>(scan.raw, {});
  const report = raw?.report ?? {};
  const validations = safeJsonParse<ValidationCheck[]>(scan.findings, []);

  const checks: ValidationCheck[] = Array.isArray(report?.checks)
    ? report.checks
    : validations;

  const insights: string[] = Array.isArray(report?.insights)
    ? report.insights
    : [];


  // =========================================================
  // Meta Inspector data
  // Reads advanced Meta payload audit from runtime scan report
  // =========================================================
  const metaInspector = report?.metaInspector ?? {
  totalCapturedMetaPayloads: 0,
  events: [],
  funnel: {
    score: 0,
    mainRisk: "No Meta funnel data",
    steps: [],
  },
  insights: [],
};

  const platform = report?.platform || "Unknown";
  const pageType = report?.pageType || "Unknown";
  const confidence: Confidence =
    report?.confidence || scoreToConfidence(overallScore);

  const gtm = categoryScores.gtm ?? categoryScores.GTM ?? 0;
  const ga4 = categoryScores.ga4 ?? categoryScores.GA4 ?? 0;
  const meta = categoryScores.meta ?? categoryScores.Meta ?? 0;
  const consent = categoryScores.consent ?? categoryScores.Consent ?? 0;
  const capi = categoryScores.capi ?? categoryScores.CAPI ?? 0;

  const gtmCheck = getCheckByName(checks, "GTM");
  const ga4Check = getCheckByName(checks, "GA4");
  const metaCheck = getCheckByName(checks, "Meta Pixel");
  const consentCheck = getCheckByName(checks, "Consent");
  const viewItemCheck = getCheckByName(checks, "view_item");
  const addToCartCheck = getCheckByName(checks, "add_to_cart");
  const checkoutCheck = getCheckByName(checks, "Checkout");
  const capiCheck = getCheckByName(checks, "CAPI");
  const ecommerceScore =
  (viewItemCheck.status === "CONFIRMED" ? 50 : viewItemCheck.status === "PARTIAL" ? 25 : 0) +
  (addToCartCheck.status === "CONFIRMED" ? 50 : addToCartCheck.status === "PARTIAL" ? 25 : 0);
  const trackingHealthScore = Math.round(
  (gtm + ga4 + meta + consent + ecommerceScore) / 5
);

  const pagesTested =
    (raw?.v2?.categoryPagesTested?.length || 0) +
    (raw?.v2?.productPagesTested?.length || 0) +
    1;

  const mainRisk = getMainRisk(checks);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="rounded-3xl border bg-gradient-to-b from-slate-50 to-white p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{scan.status}</Badge>
              <Badge>{scan.profile}</Badge>
              <Badge>{platform}</Badge>
              <Badge>{pageType}</Badge>
            </div>

            <div>
              <h1 className="break-all text-3xl font-bold">{scan.url}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Workspace{" "}
                <span className="font-medium text-foreground">
                  {scan.workspace?.name ?? "Unknown"}
                </span>{" "}
                · Created {scan.createdAt.toLocaleString()}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href="/app/scans"
                className="rounded-xl border px-4 py-2 text-sm hover:bg-muted"
              >
                Back to scans
              </Link>

              <Link
                href={`/app/shared/${scan.shareLinks?.[0]?.slug ?? "demo"}`}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:opacity-90"
              >
                View share link
              </Link>
            </div>
          </div>

          <div className="min-w-[220px] rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-muted-foreground">Tracking Health Score</div>
            <div className="mt-2 text-5xl font-bold">{trackingHealthScore}</div>
            <div className="mt-1 text-sm text-muted-foreground">/ 100</div>
            <ProgressBar value={trackingHealthScore} />
            <div className="mt-3">{confidenceBadge(confidence)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border p-5">
          <div className="text-sm text-muted-foreground">Tracking Health</div>
          <div className="mt-2 text-3xl font-bold">{trackingHealthScore}</div>
          <ProgressBar value={trackingHealthScore} />
        </div>

        <div className="rounded-2xl border p-5">
          <div className="text-sm text-muted-foreground">Ecommerce</div>
          <div className="mt-2 text-lg font-semibold">
            {viewItemCheck.status === "CONFIRMED" || addToCartCheck.status === "CONFIRMED"
              ? "Partially validated"
              : "Needs review"}
          </div>
          <div className="mt-3">
            {viewItemCheck.status === "CONFIRMED" || addToCartCheck.status === "CONFIRMED"
              ? statusBadge("PARTIAL")
              : statusBadge("NOT_CONFIRMED")}
          </div>
        </div>

        <div className="rounded-2xl border p-5">
          <div className="text-sm text-muted-foreground">Confidence</div>
          <div className="mt-2 text-lg font-semibold">{confidence}</div>
          <div className="mt-3">{confidenceBadge(confidence)}</div>
        </div>

        <div className="rounded-2xl border p-5">
          <div className="text-sm text-muted-foreground">Platform</div>
          <div className="mt-2 text-lg font-semibold">{platform}</div>
        </div>

        <div className="rounded-2xl border p-5">
          <div className="text-sm text-muted-foreground">Pages tested</div>
          <div className="mt-2 text-lg font-semibold">{pagesTested}</div>
        </div>

        <div className="rounded-2xl border p-5">
          <div className="text-sm text-muted-foreground">Main risk</div>
          <div className="mt-2 text-lg font-semibold">{mainRisk}</div>
        </div>
      </div>

      <ScanTabs
        sections={{
          Overview: (
            <div className="space-y-8">
              <div className="rounded-3xl border p-6">
                <SectionTitle
                  title="Channel Health"
                  subtitle="Quick view of your tracking stack by channel."
                />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-2xl border p-5">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">GA4</div>
                      {statusBadge(ga4Check.status)}
                    </div>
                    <div className="mt-3 text-3xl font-bold">{ga4}</div>
                    <ProgressBar value={ga4} />
                  </div>
                  <div className="rounded-2xl border p-5">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">GTM</div>
                      {statusBadge(gtmCheck.status)}
                    </div>
                    <div className="mt-3 text-3xl font-bold">{gtm}</div>
                    <ProgressBar value={gtm} />
                  </div>

                  <div className="rounded-2xl border p-5">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">Meta Pixel</div>
                      {statusBadge(metaCheck.status)}
                    </div>
                    <div className="mt-3 text-3xl font-bold">{meta}</div>
                    <ProgressBar value={meta} />
                  </div>

                  <div className="rounded-2xl border p-5">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">Consent</div>
                      {statusBadge(consentCheck.status)}
                    </div>
                    <div className="mt-3 text-3xl font-bold">{consent}</div>
                    <ProgressBar value={consent} />
                  </div>
                  <div className="rounded-2xl border p-5">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">Ecommerce</div>
                            {viewItemCheck.status === "CONFIRMED" || addToCartCheck.status === "CONFIRMED"
                              ? statusBadge(
                                  viewItemCheck.status === "CONFIRMED" &&
                                    addToCartCheck.status === "CONFIRMED"
                                    ? "CONFIRMED"
                                    : "PARTIAL"
                                )
                              : statusBadge("NOT_CONFIRMED")}
                          </div>
                          <div className="mt-3 text-3xl font-bold">{ecommerceScore}</div>
                          <ProgressBar value={ecommerceScore} />
                        </div>
                </div>
              </div>

              <div className="rounded-3xl border p-6">
                <SectionTitle
                  title="Top Insights"
                  subtitle="The 3–4 most important things to understand first."
                />

                {insights.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No insights yet.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {insights.map((item, idx) => (
                      <div key={idx} className="rounded-2xl border bg-slate-50 p-4">
                        <div className="text-sm font-medium">{item}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border p-6">
                <SectionTitle
                  title="Validation Matrix"
                  subtitle="Structured diagnostic checks with confidence, evidence and next action."
                />

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {[viewItemCheck, addToCartCheck, checkoutCheck, consentCheck, capiCheck].map(
                    (check, idx) => (
                      <div key={idx} className="rounded-2xl border p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-base font-semibold">{check.check}</div>
                          {statusBadge(check.status)}
                        </div>

                        <div className="mt-3">{confidenceBadge(check.confidence)}</div>

                        <div className="mt-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Evidence
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {check.evidence || "No direct evidence"}
                          </p>
                        </div>

                        <div className="mt-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Recommendation
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {check.action || "Review manually"}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-3xl border p-6">
                  <SectionTitle title="Executive Summary" />
                  <div className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {scan.executiveSummary || "No summary yet."}
                  </div>
                </div>

                <div className="rounded-3xl border p-6">
                  <SectionTitle title="Evidence" />

                  <div className="grid gap-4">
                    <div className="rounded-2xl border p-4">
                      <div className="mb-2 font-medium">Detected IDs</div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground">GTM:</span>{" "}
                          {gtmCheck.evidence || "None"}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">GA4:</span>{" "}
                          {ga4Check.evidence || "None"}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Meta:</span>{" "}
                          {metaCheck.evidence || "None"}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border p-4">
                      <div className="mb-2 font-medium">Runtime Signals</div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground">dataLayer:</span>{" "}
                          {Array.isArray(timeline)
                            ? timeline
                                .filter((t) => t.type === "datalayer")
                                .map((t) => t.name)
                                .filter(Boolean)
                                .slice(0, 20)
                                .join(", ") || "None"
                            : "None"}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">gtag:</span>{" "}
                          {raw?.signals?.gtagEvents?.length
                            ? raw.signals.gtagEvents.join(", ")
                            : "None"}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">fbq:</span>{" "}
                          {raw?.signals?.fbqEvents?.length
                            ? raw.signals.fbqEvents.join(", ")
                            : "None"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border p-6">
                <SectionTitle
                  title="Audit Findings"
                  subtitle="Each check rendered as a readable audit card."
                />

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {checks.map((check, idx) => (
                    <div key={idx} className="rounded-2xl border p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{check.check}</div>
                        {statusBadge(check.status)}
                      </div>

                      <div className="mt-3">{confidenceBadge(check.confidence)}</div>

                      {check.evidence ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                          {check.evidence}
                        </p>
                      ) : null}

                      {check.action ? (
                        <div className="mt-3 text-sm">
                          <span className="font-medium">Action:</span>{" "}
                          <span className="text-muted-foreground">{check.action}</span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ),

          GA4: (
            <div className="rounded-2xl border p-6">
              <h2 className="mb-4 text-lg font-semibold">GA4 Analysis</h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Status:</span>{" "}
                  {ga4Check.status}
                </div>
                <div>
                  <span className="font-medium text-foreground">Confidence:</span>{" "}
                  {ga4Check.confidence}
                </div>
                <div>
                  <span className="font-medium text-foreground">Evidence:</span>{" "}
                  {ga4Check.evidence || "No direct evidence"}
                </div>
                <div>
                  <span className="font-medium text-foreground">Action:</span>{" "}
                  {ga4Check.action || "None"}
                </div>
              </div>
            </div>
          ),

          GTM: (
            <div className="rounded-2xl border p-6">
              <h2 className="mb-4 text-lg font-semibold">GTM Container</h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Status:</span>{" "}
                  {gtmCheck.status}
                </div>
                <div>
                  <span className="font-medium text-foreground">Confidence:</span>{" "}
                  {gtmCheck.confidence}
                </div>
                <div>
                  <span className="font-medium text-foreground">Evidence:</span>{" "}
                  {gtmCheck.evidence || "No direct evidence"}
                </div>
                <div>
                  <span className="font-medium text-foreground">Action:</span>{" "}
                  {gtmCheck.action || "None"}
                </div>
              </div>
            </div>
          ),



Meta: (
  <div className="space-y-6">
    {/* =========================================================
        META OVERVIEW
    ========================================================= */}
    <div className="rounded-2xl border p-6">
      <h2 className="mb-4 text-lg font-semibold">Meta Pixel</h2>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-muted-foreground">Status</div>
          <div className="mt-2">{statusBadge(metaCheck.status)}</div>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="text-sm text-muted-foreground">Confidence</div>
          <div className="mt-2">{confidenceBadge(metaCheck.confidence)}</div>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="text-sm text-muted-foreground">Payloads Captured</div>
          <div className="mt-2 text-2xl font-bold">
            {metaInspector?.totalCapturedMetaPayloads ?? 0}
          </div>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="text-sm text-muted-foreground">Events Audited</div>
          <div className="mt-2 text-2xl font-bold">
            {Array.isArray(metaInspector?.events) ? metaInspector.events.length : 0}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">Evidence:</span>{" "}
          {metaCheck.evidence || "No direct evidence"}
        </div>
        <div>
          <span className="font-medium text-foreground">Action:</span>{" "}
          {metaCheck.action || "None"}
        </div>
      </div>
    </div>

{/* =========================================================
    META FUNNEL ENGINE
========================================================= */}
<div className="rounded-2xl border p-6">
  <div className="mb-4 flex items-start justify-between gap-4">
    <div>
      <h3 className="text-lg font-semibold">Meta Funnel Engine</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Visual validation of core Meta ecommerce events
      </p>
    </div>

    <div className="text-right">
      <div className="text-sm text-muted-foreground">Funnel Score</div>
      <div className="text-2xl font-bold">
        {metaInspector?.funnel?.score ?? 0}/100
      </div>
    </div>
  </div>

  <div className="mb-5 h-2 w-full rounded-full bg-slate-100">
    <div
      className="h-2 rounded-full bg-slate-900"
      style={{ width: `${Math.max(0, Math.min(100, metaInspector?.funnel?.score ?? 0))}%` }}
    />
  </div>

  <div className="mb-5 rounded-xl border p-4">
    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      Main Risk
    </div>
    <div className="mt-2 text-sm font-medium">
      {metaInspector?.funnel?.mainRisk || "No Meta funnel data"}
    </div>
  </div>

  <div className="grid gap-4 md:grid-cols-3">
    {Array.isArray(metaInspector?.funnel?.steps) && metaInspector.funnel.steps.length > 0 ? (
      metaInspector.funnel.steps.map((step: any) => (
        <div key={step.step} className="rounded-2xl border p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold">{step.step}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Captured {step.count} time{step.count > 1 ? "s" : ""}
              </div>
            </div>

            <span
              className={`rounded-full border px-2 py-1 text-xs font-medium ${
                step.status === "OK"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : step.status === "PARTIAL"
                  ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {step.status}
            </span>
          </div>

          <div className="mt-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Payload Quality
            </div>
            <div className="mt-2 text-lg font-semibold">{step.payloadQualityScore}/100</div>
          </div>

          <div className="mt-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Critical Issues
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.isArray(step.criticalIssues) && step.criticalIssues.length > 0 ? (
                step.criticalIssues.map((issue: string) => (
                  <span
                    key={issue}
                    className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
                  >
                    {issue}
                  </span>
                ))
              ) : (
                <span className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700">
                  No critical issues
                </span>
              )}
            </div>
          </div>
        </div>
      ))
    ) : (
      <div className="md:col-span-3 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
        No Meta funnel data available yet.
      </div>
    )}
  </div>
</div>

{/* =========================================================
    META INSIGHTS ENGINE
========================================================= */}
<div className="rounded-2xl border p-6">
  <div className="mb-4 flex items-center justify-between">
    <div>
      <h3 className="text-lg font-semibold">Meta Insights Engine</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Business diagnosis based on Meta tracking quality
      </p>
    </div>
  </div>

  {!Array.isArray(metaInspector?.insights) || metaInspector.insights.length === 0 ? (
    <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
      No insights generated yet.
    </div>
  ) : (
    <div className="space-y-4">
      {metaInspector.insights.map((insight: any, idx: number) => (
        <div key={idx} className="rounded-2xl border p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="text-base font-semibold">
              {insight.title}
            </div>

            <span
              className={`rounded-full border px-2 py-1 text-xs font-medium ${
                insight.priority === "HIGH"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : insight.priority === "MEDIUM"
                  ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                  : "border-green-200 bg-green-50 text-green-700"
              }`}
            >
              {insight.priority}
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <div className="text-xs uppercase text-muted-foreground">
                Impact
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {insight.impact}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <div className="text-xs uppercase text-muted-foreground">
                Recommended Action
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {insight.action}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</div>

    {/* =========================================================
        META PAYLOAD INSPECTOR
    ========================================================= */}
    <div className="rounded-2xl border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Meta Payload Inspector</h3>
        <div className="text-sm text-muted-foreground">
          Runtime event parameters captured from fbq(...)
        </div>
      </div>

      {!Array.isArray(metaInspector?.events) || metaInspector.events.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          No Meta event payload captured yet.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {metaInspector.events.map((item: any, idx: number) => (
            <div key={`${item.event}-${idx}`} className="rounded-2xl border p-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold">{item.event}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Captured {item.count} time{item.count > 1 ? "s" : ""}
                  </div>
                </div>

                <div className="rounded-full border px-3 py-1 text-sm font-semibold">
                  {item.payloadQualityScore}/100
                </div>
              </div>

              {/* Required / Missing */}
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Required Params
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Array.isArray(item.requiredParams) && item.requiredParams.length > 0 ? (
                      item.requiredParams.map((param: string) => (
                        <span
                          key={param}
                          className="rounded-full border bg-slate-50 px-2 py-1 text-xs"
                        >
                          {param}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No required params rule</span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Missing Params
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Array.isArray(item.missingParams) && item.missingParams.length > 0 ? (
                      item.missingParams.map((param: string) => (
                        <span
                          key={param}
                          className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
                        >
                          {param}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700">
                        No missing params
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Present params */}
              <div className="mt-4 rounded-xl border p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Present Params
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Array.isArray(item.presentParams) && item.presentParams.length > 0 ? (
                    item.presentParams.map((param: string) => (
                      <span
                        key={param}
                        className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700"
                      >
                        {param}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No params detected</span>
                  )}
                </div>
              </div>

                {/* Critical issues */}
                    <div className="mt-4 rounded-xl border p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Critical Issues
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Array.isArray(item.criticalIssues) && item.criticalIssues.length > 0 ? (
                          item.criticalIssues.map((issue: string) => (
                            <span
                              key={issue}
                              className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
                            >
                              {issue}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700">
                            No critical issues
                          </span>
                        )}
                      </div>
                    </div>

              {/* Sample payloads */}
              <div className="mt-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sample Payloads
                </div>

                {Array.isArray(item.samples) && item.samples.length > 0 ? (
                  <div className="space-y-3">
                    {item.samples.map((sample: any, sampleIdx: number) => (
                      <details key={sampleIdx} className="rounded-xl border p-3">
                        <summary className="cursor-pointer text-sm font-medium">
                          Sample #{sampleIdx + 1}
                        </summary>
                        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs">
                          {JSON.stringify(sample?.params || {}, null, 2)}
                        </pre>
                      </details>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No sample payload available.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
),

          Ecommerce: (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border p-6">
                <h2 className="mb-4 text-lg font-semibold">view_item</h2>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">Status:</span>{" "}
                    {viewItemCheck.status}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Confidence:</span>{" "}
                    {viewItemCheck.confidence}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Evidence:</span>{" "}
                    {viewItemCheck.evidence || "No direct evidence"}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Action:</span>{" "}
                    {viewItemCheck.action || "None"}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-6">
                <h2 className="mb-4 text-lg font-semibold">add_to_cart</h2>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">Status:</span>{" "}
                    {addToCartCheck.status}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Confidence:</span>{" "}
                    {addToCartCheck.confidence}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Evidence:</span>{" "}
                    {addToCartCheck.evidence || "No direct evidence"}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Action:</span>{" "}
                    {addToCartCheck.action || "None"}
                  </div>
                </div>
              </div>
            </div>
          ),

          Consent: (
            <div className="rounded-2xl border p-6">
              <h2 className="mb-4 text-lg font-semibold">Consent</h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Status:</span>{" "}
                  {consentCheck.status}
                </div>
                <div>
                  <span className="font-medium text-foreground">Confidence:</span>{" "}
                  {consentCheck.confidence}
                </div>
                <div>
                  <span className="font-medium text-foreground">Evidence:</span>{" "}
                  {consentCheck.evidence || "No direct evidence"}
                </div>
                <div>
                  <span className="font-medium text-foreground">Action:</span>{" "}
                  {consentCheck.action || "None"}
                </div>
              </div>
            </div>
          ),

          Evidence: (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border p-6">
                <h2 className="text-lg font-semibold">Detected IDs</h2>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">GTM:</span>{" "}
                    {gtmCheck.evidence || "None"}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">GA4:</span>{" "}
                    {ga4Check.evidence || "None"}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Meta:</span>{" "}
                    {metaCheck.evidence || "None"}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-6">
                <h2 className="text-lg font-semibold">Runtime Signals</h2>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">dataLayer:</span>{" "}
                    {Array.isArray(timeline)
                      ? timeline
                          .filter((t) => t.type === "datalayer")
                          .map((t) => t.name)
                          .filter(Boolean)
                          .slice(0, 20)
                          .join(", ") || "None"
                      : "None"}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">gtag:</span>{" "}
                    {raw?.signals?.gtagEvents?.length
                      ? raw.signals.gtagEvents.join(", ")
                      : "None"}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">fbq:</span>{" "}
                    {raw?.signals?.fbqEvents?.length
                      ? raw.signals.fbqEvents.join(", ")
                      : "None"}
                  </div>
                </div>
              </div>
            </div>
          ),

          Funnel: (
            <EcommerceFunnel
              timeline={timeline}
              raw={raw}
            />
          ),
          Graph: (
            <div className="rounded-2xl border p-6">
              <h2 className="mb-4 text-lg font-semibold">
                Tracking Architecture Graph
              </h2>

              <TrackingGraph
                gtm={gtm}
                ga4={ga4}
                meta={meta}
                consent={consent}
                capi={capi}
              />
            </div>
          ),

          Timeline: <ScanTimeline timeline={timeline} />,
        }}
      />
    </div>
  );
}