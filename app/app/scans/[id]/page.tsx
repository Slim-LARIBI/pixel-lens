import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
      {children}
    </span>
  );
}

export default async function ScanDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const scan = await db.scan.findUnique({
    where: { id: params.id },
    include: { workspace: true, shareLinks: true },
  });

  if (!scan) notFound();

  const overallScore = scan.overallScore ?? 0;

  const categoryScores = safeJsonParse<Record<string, number>>(
    scan.categoryScores,
    {}
  );

  const findings = safeJsonParse<any[]>(scan.findings, []);
  const timeline = safeJsonParse<any[]>(scan.eventsTimeline, []);

  const ga4 = categoryScores.ga4 ?? categoryScores.GA4 ?? 0;
  const gtm = categoryScores.gtm ?? categoryScores.GTM ?? 0;
  const meta = categoryScores.meta ?? categoryScores.Meta ?? 0;
  const capi = categoryScores.capi ?? categoryScores.CAPI ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold break-all">{scan.url}</h1>
            <Badge>{scan.status}</Badge>
            <Badge>{scan.profile}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Workspace:{" "}
            <span className="font-medium">{scan.workspace?.name ?? "Unknown"}</span>{" "}
            · Created: {scan.createdAt.toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/app/scans"
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            Back
          </Link>

          <Link
            href={`/app/shared/${scan.shareLinks?.[0]?.slug ?? "demo"}`}
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
          >
            View Share Link
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-xl border p-4">
          <div className="text-sm text-muted-foreground">Overall</div>
          <div className="mt-1 text-3xl font-bold">{overallScore}</div>
          <div className="text-xs text-muted-foreground">/ 100</div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="text-sm text-muted-foreground">GA4</div>
          <div className="mt-1 text-2xl font-semibold">{ga4}</div>
          <div className="text-xs text-muted-foreground">/ 100</div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="text-sm text-muted-foreground">GTM</div>
          <div className="mt-1 text-2xl font-semibold">{gtm}</div>
          <div className="text-xs text-muted-foreground">/ 100</div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="text-sm text-muted-foreground">Meta</div>
          <div className="mt-1 text-2xl font-semibold">{meta}</div>
          <div className="text-xs text-muted-foreground">/ 100</div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="text-sm text-muted-foreground">CAPI</div>
          <div className="mt-1 text-2xl font-semibold">{capi}</div>
          <div className="text-xs text-muted-foreground">/ 100</div>
        </div>
      </div>

      {scan.status !== "DONE" && (
        <div className="rounded-xl border p-4">
          <div className="font-medium">Scan status: {scan.status}</div>
          <p className="text-sm text-muted-foreground">
            Refresh in a few seconds if you just launched it.
          </p>
          {scan.errorMessage && (
            <p className="mt-2 text-sm text-red-600">{scan.errorMessage}</p>
          )}
        </div>
      )}

      <div className="rounded-xl border p-4">
        <div className="mb-2 font-semibold">Executive Summary</div>
        <div className="whitespace-pre-wrap text-sm leading-6">
          {scan.executiveSummary || "No summary yet."}
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold">Findings</div>
          <Badge>{findings.length}</Badge>
        </div>

        {findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No findings yet.</p>
        ) : (
          <div className="space-y-3">
            {findings.map((f, idx) => (
              <div key={idx} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">
                    {f.title ?? f.name ?? `Finding #${idx + 1}`}
                  </div>
                  <Badge>{(f.severity ?? "INFO").toString()}</Badge>
                </div>
                {f.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
                )}
                {f.fix && (
                  <div className="mt-2 text-sm">
                    <span className="font-medium">Fix:</span>{" "}
                    <span className="text-muted-foreground">{f.fix}</span>
                  </div>
                )}
                {f.code && (
                  <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                    {f.code}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold">Timeline</div>
          <Badge>{timeline.length}</Badge>
        </div>

        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No timeline yet.</p>
        ) : (
          <div className="space-y-2">
            {timeline.slice(0, 50).map((t, idx) => (
              <div key={idx} className="flex flex-col gap-1 rounded-md border p-2">
                <div className="text-sm font-medium">
                  {t.event ?? t.name ?? `Event #${idx + 1}`}
                </div>
                <div className="text-xs text-muted-foreground break-all">
                  {t.page ?? t.url ?? ""}
                </div>
                {t.data && (
                  <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(t.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}