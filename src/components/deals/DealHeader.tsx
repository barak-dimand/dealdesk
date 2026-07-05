"use client";

import { useEffect, useRef, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { Brand } from "@/components/ui/Brand";
import { Chip } from "@/components/ui/Chip";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { useDealStore } from "@/store/dealStore";
import { cn, dealStatusLabel, dealTypeLabel, formatCents } from "@/lib/utils";
import type { LayoutMode } from "@/types";

export function DealHeader() {
  const {
    layout,
    setLayout,
    activeDeal,
    deals,
    setActiveDealId,
    setActiveDeal,
    dealMenuOpen,
    setDealMenuOpen,
    setCenterTab,
    setSheetTab,
  } = useDealStore();

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDealMenuOpen(false);
      }
    }
    if (dealMenuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dealMenuOpen, setDealMenuOpen]);

  function pickDeal(deal: (typeof deals)[0]) {
    setActiveDealId(deal.id);
    setActiveDeal(deal);
    setDealMenuOpen(false);
    setCenterTab("sheet");
    setSheetTab("rentroll");
  }

  const layoutModes: { key: LayoutMode; label: string }[] = [
    { key: "command", label: "Command" },
    { key: "focus", label: "Focus" },
    { key: "split", label: "Split" },
  ];

  return (
    <header className="h-14 flex-shrink-0 flex items-center gap-3 px-3.5 bg-white border-b border-[#e6e3dc] relative z-30">
      <Brand size="md" />

      {/* Deal switcher */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setDealMenuOpen(!dealMenuOpen)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-[10px] border border-[#e6e3dc] bg-[#faf8f3] hover:bg-[#f4f2eb] transition-colors cursor-pointer"
        >
          {activeDeal ? (
            <div className="flex flex-col leading-[1.15] min-w-0">
              <span className="text-[13px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                {activeDeal.name}
              </span>
              <span className="text-[11px] text-[#9b978f] whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                {[activeDeal.city, activeDeal.state]
                  .filter(Boolean)
                  .join(", ")}{" "}
                {activeDeal.unit_count
                  ? `· ${activeDeal.unit_count} units`
                  : activeDeal.sqft
                  ? `· ${activeDeal.sqft.toLocaleString()} sqft`
                  : ""}
              </span>
            </div>
          ) : (
            <span className="text-[13px] text-[#9b978f]">Select a deal</span>
          )}
          <span className="text-[#9b978f] text-[11px]">▾</span>
        </button>

        {dealMenuOpen && deals.length > 0 && (
          <div className="absolute top-[46px] left-0 w-[300px] bg-white border border-[#e6e3dc] rounded-[12px] shadow-[0_14px_40px_rgba(40,35,25,0.16)] p-[7px] z-40">
            <div className="text-[10.5px] font-bold tracking-[0.06em] uppercase text-[#9b978f] px-[9px] py-[5px] pt-[7px]">
              Your deals
            </div>
            {deals.map((d) => (
              <button
                key={d.id}
                onClick={() => pickDeal(d)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-[10px] py-[9px] rounded-[9px] cursor-pointer text-left transition-colors",
                  activeDeal?.id === d.id
                    ? "bg-[#2f5d5014]"
                    : "hover:bg-[#f4f2eb]"
                )}
              >
                <div className="flex flex-col gap-[2px] min-w-0">
                  <span className="text-[13px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                    {d.name}
                  </span>
                  <span className="text-[11px] text-[#9b978f]">
                    {dealTypeLabel(d.deal_type)}
                    {d.asking_price
                      ? ` · ${formatCents(d.asking_price)}`
                      : ""}
                  </span>
                </div>
                <Chip
                  label={dealStatusLabel(d.status)}
                  tone={
                    d.status === "off_market"
                      ? "positive"
                      : d.status === "under_loi" || d.status === "under_contract"
                      ? "blue"
                      : d.status === "marketed"
                      ? "amber"
                      : d.status === "dead"
                      ? "negative"
                      : "default"
                  }
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Layout toggle — desktop only */}
      <div className="hidden md:flex items-center gap-[7px]">
        <span className="text-[11px] text-[#9b978f] font-medium pr-0.5">
          Layout
        </span>
        <div className="flex gap-0.5 bg-[#f1efe8] rounded-[9px] p-[3px]">
          {layoutModes.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setLayout(key)}
              className={cn(
                "px-[11px] py-[6px] text-[12.5px] font-medium rounded-[7px] cursor-pointer transition-colors",
                layout === key
                  ? "bg-[#2f5d50] text-white"
                  : "text-[#6b6862] hover:text-[#23211d]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <SettingsModal />

      <UserButton
        appearance={{
          elements: {
            avatarBox: "w-8 h-8",
          },
        }}
      />
    </header>
  );
}
