"use client";

import { useState, useRef } from "react";
import { useDealStore } from "@/store/dealStore";
import { cn } from "@/lib/utils";
import { RentRollTab } from "./RentRollTab";
import { IncomeTab } from "./IncomeTab";
import { ExpensesTab } from "./ExpensesTab";
import { SummaryTab } from "./SummaryTab";
import { EditDealModal } from "@/components/deals/EditDealModal";
import { DealIntelligenceBanner, type BannerMode } from "./DealIntelligenceBanner";
import { SheetToolbar } from "./core/SheetToolbar";
import type { Deal } from "@/types";
import { CheckCircle2, Loader2, Pencil } from "lucide-react";

const MIN_BANNER = 80;
const MAX_BANNER = 480;
const DEFAULT_BANNER = 280;

function clampHeight(h: number): number {
  return Math.max(MIN_BANNER, Math.min(MAX_BANNER, h));
}

export function SpreadsheetView() {
  const { activeDeal } = useDealStore();

  if (!activeDeal) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#9b978f] text-[13px]">
        Select a deal to view its spreadsheet.
      </div>
    );
  }

  // Keyed per deal so banner height re-hydrates via lazy initializer
  return <SpreadsheetBody key={activeDeal.id} deal={activeDeal} />;
}

function SpreadsheetBody({ deal }: { deal: Deal }) {
  const { sheetTab, documents } = useDealStore();
  const [editingDeal, setEditingDeal] = useState(false);

  const parsedCount = documents.filter((d) => d.status === "parsed").length;
  const totalCount = documents.length;
  const isParsingAny = documents.some(
    (d) => d.status === "pending" || d.status === "parsing"
  );
  const hasParsedDocs = parsedCount > 0;

  // ── Resizable banner/table split ──
  const heightKey = `dealdesk_banner_height_${deal.id}`;
  const [bannerHeight, setBannerHeight] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_BANNER;
    try {
      const saved = Number(localStorage.getItem(heightKey));
      return Number.isFinite(saved) && saved >= MIN_BANNER && saved <= MAX_BANNER
        ? saved
        : DEFAULT_BANNER;
    } catch {
      return DEFAULT_BANNER;
    }
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const heightRef = useRef(bannerHeight);
  const lastExpandedRef = useRef(
    bannerHeight > MIN_BANNER ? bannerHeight : DEFAULT_BANNER
  );

  const bannerMode: BannerMode =
    bannerHeight <= 80 ? "collapsed" : bannerHeight < 200 ? "peek" : "expanded";

  function persistHeight(h: number) {
    try {
      localStorage.setItem(heightKey, String(h));
    } catch {
      // storage blocked
    }
  }

  function applyHeight(h: number) {
    const next = clampHeight(h);
    heightRef.current = next;
    setBannerHeight(next);
    if (next > MIN_BANNER) lastExpandedRef.current = next;
  }

  function endDrag() {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    persistHeight(heightRef.current);
  }

  function onHandleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: bannerHeight };
    setIsDragging(true);

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      applyHeight(dragRef.current.startH + (ev.clientY - dragRef.current.startY));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      endDrag();
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
  }

  function onHandleTouchStart(e: React.TouchEvent) {
    dragRef.current = { startY: e.touches[0].clientY, startH: bannerHeight };
    setIsDragging(true);
  }
  function onHandleTouchMove(e: React.TouchEvent) {
    if (!dragRef.current) return;
    applyHeight(
      dragRef.current.startH + (e.touches[0].clientY - dragRef.current.startY)
    );
  }

  // Chevron: collapse to the min height, or restore the last expanded height
  function toggleBanner() {
    if (bannerHeight <= MIN_BANNER) {
      const restored = clampHeight(lastExpandedRef.current);
      heightRef.current = restored;
      setBannerHeight(restored);
      persistHeight(restored);
    } else {
      lastExpandedRef.current = bannerHeight;
      heightRef.current = MIN_BANNER;
      setBannerHeight(MIN_BANNER);
      persistHeight(MIN_BANNER);
    }
  }

  return (
    <>
    {editingDeal && (
      <EditDealModal deal={deal} onClose={() => setEditingDeal(false)} />
    )}
    <div className="flex flex-col flex-1 min-h-0 bg-white rounded-[12px] border border-[#e6e3dc] overflow-hidden">
      {/* Deal info bar */}
      <div className="flex-shrink-0 flex items-center gap-2.5 px-3.5 py-[11px] border-b border-[#eae6dd]">
        <div className="flex flex-col leading-[1.2]">
          <span className="text-[13.5px] font-semibold">{deal.name}</span>
          <span className="text-[11px] text-[#9b978f]">
            {[deal.address, deal.city, deal.state]
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

      {/* Deal intelligence — resizable top pane */}
      {hasParsedDocs && (
        <>
          <div
            style={{ height: bannerHeight }}
            className={cn(
              "flex-shrink-0 overflow-hidden",
              !isDragging && "transition-[height] duration-200"
            )}
          >
            <DealIntelligenceBanner bannerMode={bannerMode} onToggle={toggleBanner} />
          </div>

          {/* Drag handle */}
          <div
            onMouseDown={onHandleMouseDown}
            onTouchStart={onHandleTouchStart}
            onTouchMove={onHandleTouchMove}
            onTouchEnd={endDrag}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize intelligence banner"
            className="group flex-shrink-0 h-[8px] w-full cursor-row-resize bg-[#f0ede6] hover:bg-[#e6e3dc] flex items-center justify-center touch-none"
          >
            <div className="w-[32px] h-[4px] rounded-full bg-[#cdc7bb] group-hover:bg-[#b5ae9f]" />
          </div>
        </>
      )}

      {/* Sheet toolbar + grid — fills all remaining space */}
      <div
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
        style={isDragging ? { borderTop: "1px solid #2f5d50" } : undefined}
      >
        <SheetToolbar />
        {sheetTab === "rentroll" && <RentRollTab />}
        {sheetTab === "income" && <IncomeTab />}
        {sheetTab === "expenses" && <ExpensesTab />}
        {sheetTab === "summary" && <SummaryTab />}
      </div>
    </div>
    </>
  );
}
