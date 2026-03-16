"use client";

import { useState } from "react";

export default function ScanTabs({ sections }: any) {
  const tabs = Object.keys(sections);
  const [activeTab, setActiveTab] = useState(tabs[0]);

  return (
    <div>
      <div className="mb-6 rounded-2xl border p-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2 text-sm transition ${
                activeTab === tab
                  ? "bg-slate-900 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div>{sections[activeTab]}</div>
    </div>
  );
}