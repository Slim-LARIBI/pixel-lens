"use client";

import { useMemo, useState } from "react";

type DetectedTech = {
  name: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidence: string[];
};

type TechStackResult = {
  platform: DetectedTech[];
  frontend: DetectedTech[];
  ecommerce: DetectedTech[];
  tracking: DetectedTech[];
  infrastructure: DetectedTech[];
  security: DetectedTech[];
};

type ApiResponse = {
  url: string;
  result: TechStackResult;
};

function confidenceBadge(confidence: "HIGH" | "MEDIUM" | "LOW") {
  if (confidence === "HIGH") {
    return (
      <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-700">
        High
      </span>
    );
  }

  if (confidence === "MEDIUM") {
    return (
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
        Medium
      </span>
    );
  }

  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
      Low
    </span>
  );
}

function getCategoryStatus(count: number) {
  if (count >= 3) return { label: "Strong", classes: "text-green-700 bg-green-50 border-green-200" };
  if (count >= 1) return { label: "Partial", classes: "text-amber-700 bg-amber-50 border-amber-200" };
  return { label: "None", classes: "text-slate-700 bg-slate-50 border-slate-200" };
}

function countHigh(items: DetectedTech[]) {
  return items.filter((item) => item.confidence === "HIGH").length;
}

function flattenResult(result: TechStackResult | null) {
  if (!result) return [];

  return [
    ...result.platform.map((x) => ({ ...x, bucket: "Platform" })),
    ...result.ecommerce.map((x) => ({ ...x, bucket: "Ecommerce" })),
    ...result.tracking.map((x) => ({ ...x, bucket: "Tracking" })),
    ...result.frontend.map((x) => ({ ...x, bucket: "Frontend" })),
    ...result.infrastructure.map((x) => ({ ...x, bucket: "Infrastructure" })),
    ...result.security.map((x) => ({ ...x, bucket: "Security" })),
  ];
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
      {subtitle ? <div className="mt-2 text-sm text-muted-foreground">{subtitle}</div> : null}
    </div>
  );
}

function CategoryHealthCard({
  title,
  count,
  subtitle,
}: {
  title: string;
  count: number;
  subtitle: string;
}) {
  const status = getCategoryStatus(count);

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">{title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
        </div>

        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${status.classes}`}>
          {status.label}
        </span>
      </div>

      <div className="mt-5 flex items-end justify-between">
        <div className="text-4xl font-bold tracking-tight">{count}</div>
        <div className="text-sm text-muted-foreground">signals</div>
      </div>
    </div>
  );
}

function ExecutiveSignalRow({
  item,
}: {
  item: DetectedTech & { bucket: string };
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-900">{item.name}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
            {item.bucket}
          </div>
        </div>

        {confidenceBadge(item.confidence)}
      </div>

      {item.evidence?.length > 0 ? (
        <div className="mt-3 space-y-1">
          {item.evidence.slice(0, 2).map((line) => (
            <div key={line} className="text-sm text-muted-foreground">
              • {line}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptyPanel({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="text-base font-semibold">{title}</div>
      <div className="mt-4 rounded-xl border border-dashed bg-slate-50/70 p-4 text-sm text-muted-foreground">
        {text}
      </div>
    </div>
  );
}

export default function StackScanPage() {
  const [url, setUrl] = useState("https://zen.com.tn/fr");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);

  async function handleDetect() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/stack-scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Stack scan failed");
      }

      setData(json);
    } catch (e: any) {
      setError(e?.message || "Stack scan failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const result = data?.result || null;

  const stats = useMemo(() => {
    const platform = result?.platform || [];
    const frontend = result?.frontend || [];
    const ecommerce = result?.ecommerce || [];
    const tracking = result?.tracking || [];
    const infrastructure = result?.infrastructure || [];
    const security = result?.security || [];

    const all = [
      ...platform,
      ...frontend,
      ...ecommerce,
      ...tracking,
      ...infrastructure,
      ...security,
    ];

    return {
      total: all.length,
      high: countHigh(all),
      platform: platform.length,
      frontend: frontend.length,
      ecommerce: ecommerce.length,
      tracking: tracking.length,
      infrastructure: infrastructure.length,
      security: security.length,
    };
  }, [result]);

  const topSignals = useMemo(() => {
    return flattenResult(result)
      .sort((a, b) => {
        const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return rank[b.confidence] - rank[a.confidence];
      })
      .slice(0, 8);
  }, [result]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* HERO */}
      <div className="rounded-3xl border bg-gradient-to-b from-slate-50 to-white p-6">
        <div className="space-y-4">
          <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-slate-600">
            Detect Tech Stack
          </div>

          <div className="max-w-5xl">
            <h1 className="text-3xl font-bold tracking-tight">
              Executive technology overview
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Get a business-readable summary of the platform, tracking stack, frontend,
              infrastructure and security signals detected on a live website.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="h-12 flex-1 rounded-xl border bg-white px-4 text-sm outline-none"
            />

            <button
              onClick={handleDetect}
              disabled={loading}
              className="h-12 rounded-xl bg-slate-900 px-6 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "Detecting..." : "Detect Tech Stack"}
            </button>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      {/* EXECUTIVE KPIS */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Detection Mode" value={result ? "Strict" : "Ready"} subtitle="Reliable signals only" />
        <StatCard label="Detected Technologies" value={String(stats.total)} subtitle="All categories combined" />
        <StatCard label="High Confidence" value={String(stats.high)} subtitle="Strongest signals" />
        <StatCard label="Tracking Signals" value={String(stats.tracking)} subtitle="Analytics / CRM / pixels" />
        <StatCard label="Commerce Signals" value={String(stats.ecommerce + stats.platform)} subtitle="Platform + ecommerce" />
      </div>

      {data ? (
        <>
          {/* SCAN HEADER */}
          <div className="rounded-2xl border bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xl font-semibold">Scanned website</div>
                <div className="mt-1 break-all text-sm text-muted-foreground">{data.url}</div>
              </div>

              <div className="flex gap-3">
                <div className="rounded-xl border bg-slate-50 px-4 py-3">
                  <div className="text-xs text-muted-foreground">Frontend</div>
                  <div className="text-2xl font-bold">{stats.frontend}</div>
                </div>

                <div className="rounded-xl border bg-slate-50 px-4 py-3">
                  <div className="text-xs text-muted-foreground">Infra / Security</div>
                  <div className="text-2xl font-bold">{stats.infrastructure + stats.security}</div>
                </div>
              </div>
            </div>
          </div>

          {/* CATEGORY HEALTH */}
          <div className="grid gap-4 xl:grid-cols-3">
            <CategoryHealthCard
              title="Platform & Commerce"
              count={stats.platform + stats.ecommerce}
              subtitle="CMS, storefront, checkout and payment signals"
            />

            <CategoryHealthCard
              title="Tracking & Growth Stack"
              count={stats.tracking}
              subtitle="Analytics, tags, pixels, ads, CRM and automation"
            />

            <CategoryHealthCard
              title="Frontend & Infrastructure"
              count={stats.frontend + stats.infrastructure + stats.security}
              subtitle="Frameworks, CDN, consent and technical delivery"
            />
          </div>

          {/* TOP SIGNALS */}
          <div className="rounded-2xl border bg-white p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-semibold">Top detected signals</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  The most important technical findings to understand first.
                </div>
              </div>

              <div className="rounded-xl border bg-slate-50 px-4 py-2 text-right">
                <div className="text-xs text-muted-foreground">Visible now</div>
                <div className="text-2xl font-bold">{topSignals.length}</div>
              </div>
            </div>

            {topSignals.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-slate-50/70 p-4 text-sm text-muted-foreground">
                No reliable signals detected yet.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {topSignals.map((item) => (
                  <ExecutiveSignalRow
                    key={`${item.bucket}-${item.name}`}
                    item={item}
                  />
                ))}
              </div>
            )}
          </div>

          {/* BUSINESS SUMMARY */}
          <div className="grid gap-4 xl:grid-cols-3">
            {stats.platform + stats.ecommerce > 0 ? (
              <div className="rounded-2xl border bg-white p-5">
                <div className="text-base font-semibold">Commerce stack summary</div>
                <div className="mt-3 text-sm text-muted-foreground">
                  PixelLens found <span className="font-semibold text-slate-900">{stats.platform + stats.ecommerce}</span>{" "}
                  commerce-related signals on this website.
                </div>

                <div className="mt-4 space-y-2">
                  {[...result.platform, ...result.ecommerce].slice(0, 4).map((item) => (
                    <div key={item.name} className="flex items-center justify-between rounded-xl border px-3 py-2">
                      <span className="text-sm font-medium">{item.name}</span>
                      {confidenceBadge(item.confidence)}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyPanel
                title="Commerce stack summary"
                text="No reliable commerce platform or checkout technology is confirmed yet."
              />
            )}

            {stats.tracking > 0 ? (
              <div className="rounded-2xl border bg-white p-5">
                <div className="text-base font-semibold">Tracking summary</div>
                <div className="mt-3 text-sm text-muted-foreground">
                  PixelLens found <span className="font-semibold text-slate-900">{stats.tracking}</span>{" "}
                  tracking and growth signals.
                </div>

                <div className="mt-4 space-y-2">
                  {result.tracking.slice(0, 5).map((item) => (
                    <div key={item.name} className="flex items-center justify-between rounded-xl border px-3 py-2">
                      <span className="text-sm font-medium">{item.name}</span>
                      {confidenceBadge(item.confidence)}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyPanel
                title="Tracking summary"
                text="No reliable analytics, pixel or CRM signal is confirmed yet."
              />
            )}

            {stats.frontend + stats.infrastructure + stats.security > 0 ? (
              <div className="rounded-2xl border bg-white p-5">
                <div className="text-base font-semibold">Technical delivery summary</div>
                <div className="mt-3 text-sm text-muted-foreground">
                  PixelLens found <span className="font-semibold text-slate-900">{stats.frontend + stats.infrastructure + stats.security}</span>{" "}
                  frontend, infrastructure or security signals.
                </div>

                <div className="mt-4 space-y-2">
                  {[...result.frontend, ...result.infrastructure, ...result.security]
                    .slice(0, 5)
                    .map((item) => (
                      <div key={item.name} className="flex items-center justify-between rounded-xl border px-3 py-2">
                        <span className="text-sm font-medium">{item.name}</span>
                        {confidenceBadge(item.confidence)}
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <EmptyPanel
                title="Technical delivery summary"
                text="No reliable frontend, infrastructure or security signal is confirmed yet."
              />
            )}
          </div>

          {/* TRUST BLOCK */}
          <div className="rounded-2xl border bg-white p-5">
            <div className="mb-4 text-xl font-semibold">How to read this scan</div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border p-4">
                <div className="text-sm font-semibold">Business-readable</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  This page is designed to highlight the most important technical signals first.
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm font-semibold">Confidence-based</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Each technology is ranked by detection strength, not by weak keyword matching only.
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm font-semibold">Action-ready</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use this summary to understand the stack quickly before deeper technical investigation.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-3xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Run a stack scan to see the executive summary here.
        </div>
      )}
    </div>
  );
}