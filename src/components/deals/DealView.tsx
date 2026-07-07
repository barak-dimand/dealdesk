"use client";

import { useRef } from "react";
import { useDealStore } from "@/store/dealStore";
import { DealRail } from "./DealRail";
import { SpreadsheetView } from "@/components/spreadsheet/SpreadsheetView";
import { OfferRecommendation } from "@/components/offer/OfferRecommendation";
import { AIChat } from "@/components/chat/AIChat";
import { FilesPanel } from "@/components/files/FilesPanel";
import { DealNotes } from "@/components/notes/DealNotes";
import { LOIBuilder } from "@/components/loi/LOIBuilder";
import { cn } from "@/lib/utils";
import type { CenterTab, MobileTab } from "@/types";
import { LayoutDashboard, Table2, FileText, Star, MessageSquare, FolderOpen } from "lucide-react";

const CENTER_TABS: { key: CenterTab; label: string }[] = [
  { key: "sheet", label: "Spreadsheet" },
  { key: "loi", label: "LOI" },
  { key: "rec", label: "Recommendation" },
  { key: "notes", label: "Notes" },
  { key: "files", label: "Files" },
];

const MOBILE_NAV: {
  key: MobileTab;
  icon: React.ReactNode;
  label: string;
}[] = [
  { key: "deals", icon: <LayoutDashboard size={18} />, label: "Deals" },
  { key: "sheet", icon: <Table2 size={18} />, label: "Sheet" },
  { key: "notes", icon: <FileText size={18} />, label: "Notes" },
  { key: "loi", icon: <Star size={18} />, label: "LOI" },
  { key: "chat", icon: <MessageSquare size={18} />, label: "Chat" },
  { key: "files", icon: <FolderOpen size={18} />, label: "Files" },
];

export function DealView() {
  const {
    layout,
    centerTab,
    setCenterTab,
    mobileTab,
    setMobileTab,
    chatWidth,
    setChatWidth,
    activeDeal,
    loi,
  } = useDealStore();

  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);

  function onResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startW: chatWidth };

    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return;
      const delta = resizeRef.current.startX - ev.clientX;
      const newW = Math.max(300, Math.min(760, resizeRef.current.startW + delta));
      setChatWidth(newW);
    }

    function onUp() {
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
  }

  const showRecommendationInCenter = layout === "command";
  const centerTabsToShow = showRecommendationInCenter
    ? CENTER_TABS
    : CENTER_TABS.filter((t) => t.key !== "rec");

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Desktop deal rail now lives in AppSidebar */}

      {/* MOBILE: Deals tab */}
      <div
        className={cn(
          "flex md:hidden flex-col flex-1 min-h-0 overflow-hidden bg-white",
          mobileTab !== "deals" && "hidden"
        )}
      >
        <DealRail />
      </div>

      {/* CENTER PANEL */}
      <main
        className={cn(
          "flex flex-col flex-1 min-w-0 bg-[#f6f5f1] overflow-hidden",
          mobileTab === "deals" || mobileTab === "chat"
            ? "hidden md:flex"
            : "flex"
        )}
      >
        {/* Center tab bar — desktop */}
        {centerTabsToShow.length > 1 && (
          <div className="hidden md:flex items-center flex-shrink-0 px-3.5 bg-white border-b border-[#e6e3dc]">
            {centerTabsToShow.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setCenterTab(key)}
                className={cn(
                  "px-3.5 py-[9px] text-[13px] font-medium cursor-pointer transition-colors border-b-2 whitespace-nowrap",
                  centerTab === key
                    ? "text-[#23211d] font-semibold border-[#2f5d50]"
                    : "text-[#9b978f] border-transparent hover:text-[#23211d]"
                )}
              >
                {label}
              </button>
            ))}
            <div className="flex-1" />
            <span className="text-[11px] text-[#9b978f] pr-1.5">
              ● Synced with chat
            </span>
          </div>
        )}

        {/* Center content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Sheet */}
          <div
            className="h-full p-3"
            style={{
              display:
                (centerTab === "sheet" || mobileTab === "sheet") &&
                centerTab !== "loi" &&
                centerTab !== "rec" &&
                centerTab !== "notes" &&
                centerTab !== "files" &&
                mobileTab !== "loi" &&
                mobileTab !== "notes" &&
                mobileTab !== "files"
                  ? "flex"
                  : "none",
            }}
          >
            <SpreadsheetView />
          </div>

          {/* LOI Builder */}
          <div
            style={{
              display: (centerTab === "loi" || mobileTab === "loi") ? "flex" : "none",
              height: "100%",
              flexDirection: "column",
            }}
          >
            {activeDeal && (
              <LOIBuilder
                dealId={activeDeal.id}
                dealName={activeDeal.name}
                loiState={activeDeal.loi_state ?? 'none'}
                loi={loi}
              />
            )}
          </div>

          {/* Recommendation (command mode only in center) */}
          {showRecommendationInCenter && (
            <div
              style={{
                display: centerTab === "rec" ? "flex" : "none",
                height: "100%",
                flexDirection: "column",
              }}
            >
              <OfferRecommendation />
            </div>
          )}

          {/* Files */}
          <div
            style={{
              display:
                centerTab === "files" || mobileTab === "files"
                  ? "block"
                  : "none",
              height: "100%",
              overflow: "auto",
            }}
          >
            <FilesPanel />
          </div>

          {/* Notes */}
          <div
            style={{
              display:
                centerTab === "notes" || mobileTab === "notes"
                  ? "flex"
                  : "none",
              height: "100%",
              flexDirection: "column",
            }}
          >
            <DealNotes />
          </div>
        </div>
      </main>

      {/* RIGHT PANEL: Recommendation (split/focus) + Chat */}
      <aside
        className={cn(
          "hidden md:flex flex-col flex-shrink-0 border-l border-[#e6e3dc] bg-white relative min-h-0"
        )}
        style={{ width: chatWidth }}
      >
        {/* Resize handle */}
        <div
          onMouseDown={onResizeStart}
          className="absolute left-[-5px] top-0 bottom-0 w-[11px] cursor-col-resize z-10 flex items-center justify-center group"
        >
          <div className="w-[3px] h-9 rounded-full bg-[#cdc7bb] group-hover:bg-[#9b978f] transition-colors" />
        </div>

        {/* Recommendation in right panel (focus/split mode) */}
        {!showRecommendationInCenter && (
          <div className="flex-shrink-0 max-h-[52%] overflow-y-auto border-b border-[#e6e3dc]">
            <OfferRecommendation />
          </div>
        )}

        {/* Chat */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <AIChat />
        </div>
      </aside>

      {/* MOBILE: Chat tab */}
      <div
        className={cn(
          "flex md:hidden flex-col flex-1 min-h-0 overflow-hidden bg-white",
          mobileTab !== "chat" && "hidden"
        )}
      >
        <AIChat />
      </div>

      {/* MOBILE: Bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 border-t border-[#e6e3dc] bg-white flex items-stretch z-20">
        {MOBILE_NAV.map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => setMobileTab(key)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-[3px] cursor-pointer transition-colors",
              mobileTab === key ? "text-[#2f5d50]" : "text-[#9b978f]"
            )}
          >
            {icon}
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
