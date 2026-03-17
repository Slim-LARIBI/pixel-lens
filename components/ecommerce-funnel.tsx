"use client";

type FunnelEvent =
  | "view_item"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase";

type Props = {
  timeline: any[];
  raw: any;
};

function detectEvent(
  name: FunnelEvent,
  timeline: any[],
  raw: any
): boolean {
  const dl = timeline?.some(
    (t) =>
      t?.type === "datalayer" &&
      t?.name?.toLowerCase() === name
  );

  const gtag = raw?.signals?.gtagEvents?.some(
    (e: string) => e.toLowerCase() === name
  );

  const fbq = raw?.signals?.fbqEvents?.some(
    (e: string) => e.toLowerCase() === name
  );

  return dl || gtag || fbq;
}

function getColor(status: boolean) {
  if (status) return "bg-green-100 text-green-700 border-green-200";
  return "bg-red-100 text-red-700 border-red-200";
}

export default function EcommerceFunnel({
  timeline,
  raw,
}: Props) {
  const events: FunnelEvent[] = [
    "view_item",
    "add_to_cart",
    "begin_checkout",
    "purchase",
  ];

  const results = events.map((e) => ({
    name: e,
    detected: detectEvent(e, timeline, raw),
  }));

  const score =
    (results.filter((r) => r.detected).length /
      events.length) *
    100;

  return (
    <div className="space-y-6">

      <div className="rounded-2xl border p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Ecommerce Funnel
          </h2>

          <div className="text-sm font-semibold">
            {Math.round(score)}/100
          </div>
        </div>

        <div className="mt-4 h-2 w-full rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-slate-900"
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

        {results.map((r) => (
          <div
            key={r.name}
            className={`rounded-xl border p-5 ${getColor(
              r.detected
            )}`}
          >
            <div className="text-sm font-semibold">
              {r.name}
            </div>

            <div className="mt-2 text-xs">
              {r.detected
                ? "Detected"
                : "Missing"}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}