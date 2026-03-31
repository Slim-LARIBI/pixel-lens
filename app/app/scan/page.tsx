"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

type ScanType = "QUICK" | "RUNTIME";

const RUNTIME_STEPS = [
  { label: "Launching headless browser", duration: 8000 },
  { label: "Loading page & waiting for scripts", duration: 15000 },
  { label: "Installing tracking interceptor", duration: 5000 },
  { label: "Navigating ecommerce funnel", duration: 25000 },
  { label: "Capturing GA4 / Meta / GTM signals", duration: 15000 },
  { label: "Building report & scoring", duration: 10000 },
];

function useProgressSteps(running: boolean) {
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) {
      setStepIndex(0);
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 500;
        let acc = 0;
        for (let i = 0; i < RUNTIME_STEPS.length; i++) {
          acc += RUNTIME_STEPS[i].duration;
          if (next < acc) {
            setStepIndex(i);
            break;
          }
        }
        return next;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [running]);

  return { stepIndex, elapsed };
}

export default function ScanPage() {
  const [url, setUrl] = useState("");
  const [scanType, setScanType] = useState<ScanType>("RUNTIME");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { stepIndex } = useProgressSteps(loading && scanType === "RUNTIME");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let workspaceId: string | undefined;
      try {
        const wsRes = await fetch("/api/workspaces/current");
        if (wsRes.ok) {
          const ws = await wsRes.json();
          workspaceId = ws?.id;
        }
      } catch {}

      const endpoint = scanType === "RUNTIME" ? "/api/scans/runtime" : "/api/scans";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          profile: scanType,
          ...(workspaceId ? { workspaceId } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Scan failed");
      }

      if (!data?.id) {
        throw new Error("No scan ID returned");
      }

      toast({
        title: "Scan complete",
        description: "Opening your report…",
      });

      router.push(`/app/scans/${data.id}`);
    } catch (error: any) {
      toast({
        title: "Scan failed",
        description: error?.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Run New Scan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Audit your tracking stack — GA4, GTM, Meta Pixel, Consent
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* URL */}
        <div className="rounded-2xl border p-5 space-y-3">
          <label className="text-sm font-medium" htmlFor="url">
            Website URL
          </label>
          <input
            id="url"
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={loading}
            className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
          />
        </div>

        {/* Scan type */}
        <div className="rounded-2xl border p-5 space-y-3">
          <div className="text-sm font-medium">Scan type</div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setScanType("RUNTIME")}
              disabled={loading}
              className={`rounded-xl border p-4 text-left transition-all ${
                scanType === "RUNTIME"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "hover:border-slate-400"
              }`}
            >
              <div className="text-sm font-semibold">Runtime Scan</div>
              <div
                className={`mt-1 text-xs ${
                  scanType === "RUNTIME" ? "text-slate-300" : "text-muted-foreground"
                }`}
              >
                Playwright · Full funnel · ~60s
              </div>
            </button>

            <button
              type="button"
              onClick={() => setScanType("QUICK")}
              disabled={loading}
              className={`rounded-xl border p-4 text-left transition-all ${
                scanType === "QUICK"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "hover:border-slate-400"
              }`}
            >
              <div className="text-sm font-semibold">Quick Scan</div>
              <div
                className={`mt-1 text-xs ${
                  scanType === "QUICK" ? "text-slate-300" : "text-muted-foreground"
                }`}
              >
                HTML only · Fast · ~3s
              </div>
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            {scanType === "RUNTIME"
              ? "Opens your site in a headless browser, intercepts network calls, and validates GA4/Meta events through the full ecommerce funnel."
              : "Fetches your page HTML and detects GTM, GA4, Meta Pixel and consent signals via static analysis. No browser required."}
          </p>
        </div>

        {/* Progress (Runtime only, while loading) */}
        {loading && scanType === "RUNTIME" && (
          <div className="rounded-2xl border p-5 space-y-3">
            <div className="text-sm font-medium">Scan in progress…</div>
            <div className="space-y-2">
              {RUNTIME_STEPS.map((step, i) => {
                const isDone = i < stepIndex;
                const isActive = i === stepIndex;
                return (
                  <div key={step.label} className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full flex-shrink-0 ${
                        isDone
                          ? "bg-green-500"
                          : isActive
                          ? "bg-slate-900 animate-pulse"
                          : "bg-slate-200"
                      }`}
                    />
                    <span
                      className={`text-sm ${
                        isDone
                          ? "text-muted-foreground line-through"
                          : isActive
                          ? "font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !url}
          className="h-12 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {loading
            ? scanType === "RUNTIME"
              ? "Running runtime scan…"
              : "Running quick scan…"
            : scanType === "RUNTIME"
            ? "Start Runtime Scan"
            : "Start Quick Scan"}
        </button>
      </form>

      {/* What we capture */}
      <div className="rounded-2xl border p-5">
        <div className="mb-3 text-sm font-medium">
          {scanType === "RUNTIME" ? "Runtime scan captures" : "Quick scan captures"}
        </div>
        {scanType === "RUNTIME" ? (
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>✓ GTM container + full dataLayer capture</li>
            <li>✓ GA4 collect requests + ecommerce event funnel</li>
            <li>✓ Meta Pixel fbq() calls + network validation</li>
            <li>✓ Google Ads conversion tracking</li>
            <li>✓ Consent / CMP detection</li>
            <li>✓ Payload quality scoring per event</li>
          </ul>
        ) : (
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>✓ GTM container IDs from HTML</li>
            <li>✓ GA4 Measurement IDs from HTML</li>
            <li>✓ Meta Pixel script detection</li>
            <li>✓ Consent / CMP signals</li>
            <li>↳ No event-level validation (use Runtime for that)</li>
          </ul>
        )}
      </div>
    </div>
  );
}
