"use client";

import React from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

type ChannelNodeData = {
  title: string;
  score?: number;
  subtitle?: string;
  tone?: "dark" | "neutral" | "success" | "warning" | "danger";
};

function getTone(score: number): ChannelNodeData["tone"] {
  if (score >= 80) return "success";
  if (score >= 40) return "warning";
  return "danger";
}

function getSubtitle(score?: number) {
  if (typeof score !== "number") return "";
  if (score >= 80) return "Healthy";
  if (score >= 40) return "Needs review";
  return "Critical";
}

function toneClasses(tone: ChannelNodeData["tone"]) {
  switch (tone) {
    case "dark":
      return {
        bg: "#0f172a",
        border: "#0f172a",
        text: "#ffffff",
        chipBg: "rgba(255,255,255,0.14)",
        chipText: "#ffffff",
      };
    case "neutral":
      return {
        bg: "#334155",
        border: "#334155",
        text: "#ffffff",
        chipBg: "rgba(255,255,255,0.14)",
        chipText: "#ffffff",
      };
    case "success":
      return {
        bg: "#ecfdf3",
        border: "#86efac",
        text: "#166534",
        chipBg: "#dcfce7",
        chipText: "#166534",
      };
    case "warning":
      return {
        bg: "#fefce8",
        border: "#fde68a",
        text: "#92400e",
        chipBg: "#fef3c7",
        chipText: "#92400e",
      };
    case "danger":
    default:
      return {
        bg: "#fef2f2",
        border: "#fca5a5",
        text: "#b91c1c",
        chipBg: "#fee2e2",
        chipText: "#b91c1c",
      };
  }
}

function edgeColor(score: number) {
  if (score >= 80) return "#22c55e";
  if (score >= 40) return "#eab308";
  return "#ef4444";
}

function ChannelNode({ data }: NodeProps<ChannelNodeData>) {
  const tone = toneClasses(data.tone || "neutral");

  return (
    <div
      style={{
        minWidth: 210,
        borderRadius: 18,
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.text,
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
        padding: 14,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "#0f172a", width: 8, height: 8 }}
      />

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{data.title}</div>
            {data.subtitle ? (
              <div className="mt-1 text-xs opacity-80">{data.subtitle}</div>
            ) : null}
          </div>

          {typeof data.score === "number" ? (
            <div
              style={{
                borderRadius: 999,
                background: tone.chipBg,
                color: tone.chipText,
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 10px",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {data.score}/100
            </div>
          ) : null}
        </div>

        {typeof data.score === "number" ? (
          <div>
            <div
              style={{
                height: 8,
                width: "100%",
                borderRadius: 999,
                background: "rgba(148, 163, 184, 0.20)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(0, Math.min(100, data.score))}%`,
                  borderRadius: 999,
                  background:
                    data.score >= 80
                      ? "#22c55e"
                      : data.score >= 40
                      ? "#eab308"
                      : "#ef4444",
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "#0f172a", width: 8, height: 8 }}
      />
    </div>
  );
}

const nodeTypes = {
  channelNode: ChannelNode,
};

export default function TrackingGraph({
  gtm,
  ga4,
  meta,
  consent,
  capi,
}: {
  gtm: number;
  ga4: number;
  meta: number;
  consent: number;
  capi: number;
}) {
  const nodes: Node<ChannelNodeData>[] = [
    {
      id: "site",
      type: "channelNode",
      position: { x: 0, y: 180 },
      data: {
        title: "Website",
        subtitle: "Runtime source",
        tone: "dark",
      },
      draggable: false,
    },
    {
      id: "datalayer",
      type: "channelNode",
      position: { x: 280, y: 180 },
      data: {
        title: "dataLayer",
        subtitle: "Client-side payload layer",
        tone: "neutral",
      },
      draggable: false,
    },
    {
      id: "gtm",
      type: "channelNode",
      position: { x: 590, y: 180 },
      data: {
        title: "GTM",
        score: gtm,
        subtitle: getSubtitle(gtm),
        tone: getTone(gtm),
      },
      draggable: false,
    },
    {
      id: "ga4",
      type: "channelNode",
      position: { x: 980, y: 20 },
      data: {
        title: "GA4",
        score: ga4,
        subtitle: getSubtitle(ga4),
        tone: getTone(ga4),
      },
      draggable: false,
    },
    {
      id: "meta",
      type: "channelNode",
      position: { x: 980, y: 160 },
      data: {
        title: "Meta Pixel",
        score: meta,
        subtitle: getSubtitle(meta),
        tone: getTone(meta),
      },
      draggable: false,
    },
    {
      id: "server",
      type: "channelNode",
      position: { x: 980, y: 300 },
      data: {
        title: "Server",
        subtitle: "Server-side tracking",
        tone: "neutral",
      },
      draggable: false,
    },
    {
      id: "consent",
      type: "channelNode",
      position: { x: 1360, y: 220 },
      data: {
        title: "Consent",
        score: consent,
        subtitle: getSubtitle(consent),
        tone: getTone(consent),
      },
      draggable: false,
    },
    {
      id: "capi",
      type: "channelNode",
      position: { x: 1360, y: 380 },
      data: {
        title: "CAPI",
        score: capi,
        subtitle: getSubtitle(capi),
        tone: getTone(capi),
      },
      draggable: false,
    },
  ];

  const edgeBase = {
    type: "smoothstep",
    animated: true,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color: "#94a3b8",
    },
    style: {
      stroke: "#94a3b8",
      strokeWidth: 2,
    },
  };

  const edges: Edge[] = [
    {
      id: "e1",
      source: "site",
      target: "datalayer",
      ...edgeBase,
    },
    {
      id: "e2",
      source: "datalayer",
      target: "gtm",
      ...edgeBase,
    },
    {
      id: "e3",
      source: "gtm",
      target: "ga4",
      ...edgeBase,
      style: { stroke: edgeColor(ga4), strokeWidth: 3 },
    },
    {
      id: "e4",
      source: "gtm",
      target: "meta",
      ...edgeBase,
      style: { stroke: edgeColor(meta), strokeWidth: 3 },
    },
    {
      id: "e5",
      source: "gtm",
      target: "server",
      ...edgeBase,
      style: { stroke: "#64748b", strokeWidth: 3 },
    },
    {
      id: "e6",
      source: "server",
      target: "consent",
      ...edgeBase,
      style: { stroke: edgeColor(consent), strokeWidth: 3 },
    },
    {
      id: "e7",
      source: "server",
      target: "capi",
      ...edgeBase,
      style: { stroke: edgeColor(capi), strokeWidth: 3 },
    },
  ];

  return (
    <div className="h-[700px] w-full overflow-hidden rounded-2xl border bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1.2} color="#e2e8f0" />
        <Controls />
      </ReactFlow>
    </div>
  );
}