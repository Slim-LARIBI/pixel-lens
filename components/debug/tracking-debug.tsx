"use client";

export default function TrackingDebug({ raw }: { raw: any }) {
  const debug = raw?.report?.ga4Inspector?.debug;

  if (!debug) return null;

  return (
    <div className="p-6 bg-black text-green-400 rounded-2xl text-xs font-mono space-y-2">
      <div className="text-white font-semibold mb-2">
        Tracking Debug (Interceptor)
      </div>

      <div>dataLayer: {debug.dataLayerCount}</div>
      <div>gtag: {debug.gtagCount}</div>
      <div>fbq: {debug.fbqCount}</div>
      <div>fetch: {debug.fetchCount}</div>
      <div>xhr: {debug.xhrCount}</div>
      <div>beacon: {debug.beaconCount}</div>
    </div>
  );
}