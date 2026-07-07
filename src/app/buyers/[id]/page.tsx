"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const TABS = ["Overview", "Buy Box", "Deals Sent", "Activity"] as const;

export default function BuyerPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#f6f5f1]">
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-[#e6e3dc]">
        <h1 className="text-[17px] font-bold tracking-[-0.02em] text-[#23211d]">
          Buyer
        </h1>
      </div>

      <div className="flex-shrink-0 flex items-center px-4 bg-white border-b border-[#e6e3dc] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3.5 py-[9px] text-[13px] font-medium cursor-pointer transition-colors border-b-2 whitespace-nowrap",
              tab === t
                ? "text-[#23211d] font-semibold border-[#2f5d50]"
                : "text-[#9b978f] border-transparent hover:text-[#23211d]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-[#9b978f]">{tab} — Coming soon</p>
      </div>
    </div>
  );
}
