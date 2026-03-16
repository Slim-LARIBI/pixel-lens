"use client";

type TimelineItem = {
  ts?: number;
  type?: string;
  name?: string;
  event?: string;
  url?: string;
  page?: string;
  payload?: any;
  data?: any;
};

type GroupedItem = {
  key: string;
  label: string;
  tone: string;
  type: string;
  meta?: string;
  count: number;
  items: TimelineItem[];
  latestPayload?: any;
};

function getLabel(item: TimelineItem) {
  return item.event || item.name || "Event";
}

function getMeta(item: TimelineItem) {
  if (item.url) return item.url;
  if (item.page) return item.page;
  return "";
}

function getTone(label: string) {
  const s = label.toLowerCase();

  if (s.includes("error") || s.includes("fail")) return "red";
  if (s.includes("purchase")) return "emerald";
  if (s.includes("checkout")) return "violet";
  if (s.includes("add_to_cart")) return "green";
  if (s.includes("view_item")) return "blue";
  if (s.includes("product")) return "indigo";
  if (s.includes("category")) return "sky";
  if (s.includes("consent")) return "amber";
  if (s.includes("gtm") || s.includes("gtag") || s.includes("ga4")) return "slate";
  return "slate";
}

function dotClass(tone: string) {
  if (tone === "red") return "bg-red-500";
  if (tone === "emerald") return "bg-emerald-500";
  if (tone === "violet") return "bg-violet-500";
  if (tone === "green") return "bg-green-500";
  if (tone === "blue") return "bg-blue-500";
  if (tone === "indigo") return "bg-indigo-500";
  if (tone === "sky") return "bg-sky-500";
  if (tone === "amber") return "bg-amber-500";
  return "bg-slate-900";
}

function badgeClass(tone: string) {
  if (tone === "red") return "bg-red-50 text-red-700 border-red-200";
  if (tone === "emerald") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (tone === "violet") return "bg-violet-50 text-violet-700 border-violet-200";
  if (tone === "green") return "bg-green-50 text-green-700 border-green-200";
  if (tone === "blue") return "bg-blue-50 text-blue-700 border-blue-200";
  if (tone === "indigo") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (tone === "sky") return "bg-sky-50 text-sky-700 border-sky-200";
  if (tone === "amber") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function normalizeType(item: TimelineItem) {
  return item.type || "event";
}

function isTechnical(label: string) {
  const s = label.toLowerCase();
  return (
    s === "gtm.js" ||
    s === "gtag.js" ||
    s === "ga4.collect" ||
    s === "meta.tr" ||
    s === "datalayer.push" ||
    s === "gtm.dom" ||
    s === "gtm.load" ||
    s === "gtm.scrollDepth".toLowerCase() ||
    s === "gtm.click"
  );
}

function isJourney(label: string) {
  const s = label.toLowerCase();
  return (
    s.includes("view_item") ||
    s.includes("add_to_cart") ||
    s.includes("checkout") ||
    s.includes("purchase") ||
    s.includes("product_page_tested") ||
    s.includes("category_page_tested") ||
    s.includes("consent.click") ||
    s.includes("internal_pages_detected")
  );
}

function groupTimeline(items: TimelineItem[]) {
  const map = new Map<string, GroupedItem>();

  for (const item of items) {
    const label = getLabel(item);
    const meta = getMeta(item);
    const type = normalizeType(item);
    const tone = getTone(label);

    const key = `${label}__${meta || ""}__${type}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        label,
        meta,
        type,
        tone,
        count: 0,
        items: [],
        latestPayload: item.payload ?? item.data,
      });
    }

    const current = map.get(key)!;
    current.count += 1;
    current.items.push(item);
    current.latestPayload = item.payload ?? item.data ?? current.latestPayload;
  }

  return Array.from(map.values());
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function TimelineCard({
  item,
  showLine = true,
}: {
  item: GroupedItem;
  showLine?: boolean;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`h-3 w-3 rounded-full ${dotClass(item.tone)}`} />
        {showLine ? <div className="mt-2 h-full min-h-10 w-px bg-slate-200" /> : null}
      </div>

      <div className="w-full rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold">{item.label}</div>

              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] ${badgeClass(
                  item.tone
                )}`}
              >
                {item.type}
              </span>

              {item.count > 1 ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                  {item.count}x
                </span>
              ) : null}
            </div>

            {item.meta ? (
              <div className="mt-1 break-all text-xs text-muted-foreground">
                {item.meta}
              </div>
            ) : null}
          </div>
        </div>

        {item.latestPayload ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
              Show payload
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              {JSON.stringify(item.latestPayload, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}

export default function ScanTimeline({
  timeline,
}: {
  timeline: TimelineItem[];
}) {
  if (!timeline?.length) {
    return (
      <div className="rounded-2xl border p-6 text-sm text-muted-foreground">
        No timeline yet.
      </div>
    );
  }

  const grouped = groupTimeline(timeline);

  const journey = grouped.filter((x) => isJourney(x.label));
  const technical = grouped.filter((x) => isTechnical(x.label));
  const other = grouped.filter((x) => !isJourney(x.label) && !isTechnical(x.label));

  const journeyCount = journey.length;
  const technicalCount = technical.length;

  return (
    <div className="space-y-6">
      <Section
        title="Timeline Pro"
        subtitle="Priority journey first, technical trace second."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-4">
            <div className="text-sm text-muted-foreground">Journey Events</div>
            <div className="mt-2 text-3xl font-bold">{journeyCount}</div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-sm text-muted-foreground">Technical Events</div>
            <div className="mt-2 text-3xl font-bold">{technicalCount}</div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-sm text-muted-foreground">Raw Events</div>
            <div className="mt-2 text-3xl font-bold">{timeline.length}</div>
          </div>
        </div>
      </Section>

      <Section
        title="Journey Timeline"
        subtitle="The events that matter most for ecommerce validation."
      >
        {journey.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No journey events detected.
          </div>
        ) : (
          <div className="space-y-4">
            {journey.map((item, idx) => (
              <TimelineCard
                key={item.key}
                item={item}
                showLine={idx < journey.length - 1}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Technical Trace"
        subtitle="Underlying requests and technical tracking calls."
      >
        {technical.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No technical trace detected.
          </div>
        ) : (
          <div className="space-y-4">
            {technical.map((item, idx) => (
              <TimelineCard
                key={item.key}
                item={item}
                showLine={idx < technical.length - 1}
              />
            ))}
          </div>
        )}
      </Section>

      {other.length > 0 ? (
        <Section
          title="Other Events"
          subtitle="Additional signals that do not fit the main groups."
        >
          <div className="space-y-4">
            {other.map((item, idx) => (
              <TimelineCard
                key={item.key}
                item={item}
                showLine={idx < other.length - 1}
              />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}