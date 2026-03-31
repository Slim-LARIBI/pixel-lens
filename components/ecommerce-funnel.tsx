"use client";

type Step = {
  step: string;
  status: "OK" | "MISSING" | "PARTIAL";
  detected: boolean;
  count?: number;
  payloadQualityScore?: number;
  criticalIssues?: string[];
};

type Props = {
  funnel: {
    score?: number;
    mainRisk?: string;
    steps: Step[];
  };
};

function getStepBadgeClasses(status: string) {
  if (status === "OK") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (status === "PARTIAL") {
    return "border-yellow-200 bg-yellow-50 text-yellow-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function getDotClasses(status: string) {
  if (status === "OK") return "bg-green-500";
  if (status === "PARTIAL") return "bg-yellow-500";
  return "bg-red-500";
}

function getLabel(step: string) {
  const labels: Record<string, string> = {
    view_item: "View Item",
    add_to_cart: "Add To Cart",
    begin_checkout: "Checkout",
    purchase: "Purchase",
  };

  return labels[step] || step;
}

export default function EcommerceFunnel({ funnel }: Props) {
  const steps = Array.isArray(funnel?.steps) ? funnel.steps : [];
  const score = typeof funnel?.score === "number" ? funnel.score : 0;
  const mainRisk = funnel?.mainRisk || "No major funnel risk detected";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Ecommerce Funnel</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Visual validation of the ecommerce journey from product view to purchase
            </p>
          </div>

          <div className="text-right">
            <div className="text-sm text-muted-foreground">Funnel Score</div>
            <div className="text-2xl font-bold">{Math.round(score)}/100</div>
          </div>
        </div>

        <div className="mb-5 h-2 w-full rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-slate-900"
            style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
          />
        </div>

        <div className="rounded-xl border p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Main Risk
          </div>
          <div className="mt-2 text-sm font-medium">{mainRisk}</div>
        </div>
      </div>

      <div className="rounded-2xl border p-6">
        {!steps.length ? (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            No funnel data available yet.
          </div>
        ) : (
          <>
            <div className="mb-8 flex items-center justify-between gap-2 overflow-x-auto">
              {steps.map((step, index) => (
                <div key={step.step} className="flex min-w-[180px] flex-1 items-center">
                  <div className="flex w-full flex-col items-center">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ${getDotClasses(
                        step.status
                      )}`}
                    >
                      {index + 1}
                    </div>

                    <div className="mt-3 text-center text-sm font-medium">
                      {getLabel(step.step)}
                    </div>

                    <div
                      className={`mt-2 rounded-full border px-2 py-1 text-xs font-medium ${getStepBadgeClasses(
                        step.status
                      )}`}
                    >
                      {step.status}
                    </div>
                  </div>

                  {index < steps.length - 1 && (
                    <div className="mx-3 h-[2px] flex-1 bg-slate-200" />
                  )}
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {steps.map((step) => (
                <div key={step.step} className="rounded-xl border p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{getLabel(step.step)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Captured {step.count ?? 0} time{(step.count ?? 0) > 1 ? "s" : ""}
                      </div>
                    </div>

                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-medium ${getStepBadgeClasses(
                        step.status
                      )}`}
                    >
                      {step.status}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Payload Quality
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                      {typeof step.payloadQualityScore === "number"
                        ? `${step.payloadQualityScore}/100`
                        : "N/A"}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Critical Issues
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {Array.isArray(step.criticalIssues) && step.criticalIssues.length > 0 ? (
                        step.criticalIssues.map((issue) => (
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
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}