"use client";

import { useState } from "react";
import { useDealStore } from "@/store/dealStore";
import { cn } from "@/lib/utils";
import { RentRollTab } from "./RentRollTab";
import { IncomeTab } from "./IncomeTab";
import { ExpensesTab } from "./ExpensesTab";
import { SummaryTab } from "./SummaryTab";
import { EditDealModal } from "@/components/deals/EditDealModal";
import { DealIntelligenceBanner } from "./DealIntelligenceBanner";
import type { SheetTab } from "@/types";
import { CheckCircle2, Loader2, Pencil } from "lucide-react";

const TABS: { key: SheetTab; label: string }[] = [
  { key: "rentroll", label: "Rent Roll" },
  { key: "income", label: "Income" },
  { key: "expenses", label: "Expenses" },
  { key: "summary", label: "Summary" },
];

export function SpreadsheetView() {
  const { activeDeal, sheetTab, setSheetTab, documents } = useDealStore();
  const [editingDeal, setEditingDeal] = useState(false);
  const parsedCount = documents.filter((d) => d.status === "parsed").length;
  const totalCount = documents.length;
  const isParsingAny = documents.some(
    (d) => d.status === "pending" || d.status === "parsing"
  );

  if (!activeDeal) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#9b978f] text-[13px]">
        Select a deal to view its spreadsheet.
      </div>
    );
  }

  return (
    <>
    {editingDeal && (
      <EditDealModal deal={activeDeal} onClose={() => setEditingDeal(false)} />
    )}
    <div className="flex flex-col flex-1 min-h-0 bg-white rounded-[12px] border border-[#e6e3dc] overflow-hidden">
      {/* Deal info bar */}
      <div className="flex-shrink-0 flex items-center gap-2.5 px-3.5 py-[11px] border-b border-[#eae6dd]">
        <div className="flex flex-col leading-[1.2]">
          <span className="text-[13.5px] font-semibold">{activeDeal.name}</span>
          <span className="text-[11px] text-[#9b978f]">
            {[activeDeal.address, activeDeal.city, activeDeal.state]
              .filter(Boolean)
              .join(", ") ||
              (totalCount > 0
                ? `${totalCount} document${totalCount !== 1 ? "s" : ""}`
                : "No documents")}
          </span>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setEditingDeal(true)}
          title="Edit deal"
          className="w-7 h-7 flex items-center justify-center rounded-[7px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#3a3833] transition-colors"
        >
          <Pencil size={13} />
        </button>
        {isParsingAny && (
          <div className="flex items-center gap-1.5 text-[11.5px] text-[#3a5299] bg-[#e8ecf5] border border-[#c8d0e8] rounded-[7px] px-2.5 py-[5px]">
            <Loader2 size={13} className="animate-spin" />
            Parsing documents…
          </div>
        )}
        {!isParsingAny && parsedCount > 0 && (
          <div className="flex items-center gap-1.5 text-[11.5px] text-[#2f6d4f] bg-[#eaf1ec] border border-[#d4e3d9] rounded-[7px] px-2.5 py-[5px]">
            <CheckCircle2 size={13} />
            AI edits enabled
          </div>
        )}
      </div>

      {/* Deal intelligence */}
      <DealIntelligenceBanner />

      {/* Sheet content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {sheetTab === "rentroll" && <RentRollTab />}
        {sheetTab === "income" && <IncomeTab />}
        {sheetTab === "expenses" && <ExpensesTab />}
        {sheetTab === "summary" && <SummaryTab />}
      </div>

      {/* Sheet tab bar */}
      <div className="flex-shrink-0 flex items-center gap-1 px-3 pt-[5px] pb-0 bg-[#f3f1ea] border-t border-[#e6e3dc] overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSheetTab(key)}
            className={cn(
              "px-3.5 py-[6px] text-[12.5px] font-medium rounded-t-[8px] whitespace-nowrap cursor-pointer transition-colors border border-b-0",
              sheetTab === key
                ? "bg-white text-[#2f5d50] font-semibold border-[#e6e3dc]"
                : "bg-transparent text-[#6b6862] border-transparent hover:text-[#23211d]"
            )}
            style={sheetTab === key ? { marginBottom: "-1px" } : {}}
          >
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[11px] text-[#9b978f] px-1.5 pb-1.5 whitespace-nowrap">
          {parsedCount} of {totalCount} docs parsed
        </span>
      </div>
    </div>
    </>
  );
}
