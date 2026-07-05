"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDealStore } from "@/store/dealStore";
import { Chip } from "@/components/ui/Chip";
import {
  cn,
  dealStatusLabel,
  dealTypeLabel,
  formatCents,
} from "@/lib/utils";
import type { Deal, DealStatus } from "@/types";
import { Plus, Search } from "lucide-react";

function statusTone(
  status: DealStatus
): "positive" | "negative" | "amber" | "blue" | "default" {
  if (status === "off_market") return "positive";
  if (status === "under_loi" || status === "under_contract") return "blue";
  if (status === "marketed") return "amber";
  if (status === "dead") return "negative";
  return "default";
}

function DealItem({ deal }: { deal: Deal }) {
  const { activeDeal, setActiveDealId, setActiveDeal, setCenterTab, setSheetTab } =
    useDealStore();
  const router = useRouter();

  const active = activeDeal?.id === deal.id;
  const isParsing =
    (deal.document_count ?? 0) > 0 &&
    (deal.parsed_document_count ?? 0) < (deal.document_count ?? 0);

  function pick() {
    setActiveDealId(deal.id);
    setActiveDeal(deal);
    setCenterTab("sheet");
    setSheetTab("rentroll");
    if (!active) router.push(`/deals/${deal.id}`);
  }

  const metric = deal.asking_price ? formatCents(deal.asking_price) : "—";

  return (
    <button
      onClick={pick}
      className={cn(
        "w-full flex flex-col gap-[3px] px-[11px] py-[10px] rounded-[10px] cursor-pointer text-left transition-colors",
        active
          ? "bg-[#2f5d5014] border border-[#2f5d5033]"
          : "border border-transparent hover:bg-[#f4f2eb]"
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[13px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
          {deal.name}
        </span>
        <Chip
          label={dealStatusLabel(deal.status)}
          tone={statusTone(deal.status)}
        />
      </div>
      <span className="text-[11.5px] text-[#9b978f]">
        {[deal.city, deal.state].filter(Boolean).join(", ")}
        {deal.unit_count ? ` · ${deal.unit_count} units` : ""}
        {deal.sqft ? ` · ${deal.sqft.toLocaleString()} sqft` : ""}
      </span>
      <div className="flex items-center justify-between gap-1.5 mt-0.5">
        <span className="text-[10.5px] font-semibold text-[#8a857a] tracking-[0.03em] uppercase">
          {dealTypeLabel(deal.deal_type)}
        </span>
        <span className="text-[12px] font-mono text-[#3a3833]">{metric}</span>
      </div>
      {isParsing && (
        <div className="mt-1 flex items-center gap-1.5">
          <div className="h-1 flex-1 bg-[#eae6dd] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2f5d50] rounded-full transition-all"
              style={{
                width: `${
                  ((deal.parsed_document_count ?? 0) /
                    Math.max(deal.document_count ?? 1, 1)) *
                  100
                }%`,
              }}
            />
          </div>
          <span className="text-[10px] text-[#9b978f]">Parsing…</span>
        </div>
      )}
      {(deal.loi_state === "draft" || deal.loi_state === "sent") && (
        <div className="flex items-center gap-1 mt-0.5">
          <div
            className={cn(
              "w-[6px] h-[6px] rounded-full flex-shrink-0",
              deal.loi_state === "sent" ? "bg-[#2f6d4f]" : "bg-[#9a6b3f]"
            )}
          />
          <span className="text-[11px] text-[#9b978f]">
            {deal.loi_state === "sent" ? "LOI sent" : "LOI ready"}
          </span>
        </div>
      )}
    </button>
  );
}

export function DealRail() {
  const { deals, isLoadingDeals } = useDealStore();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = deals.filter(
    (d) =>
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.city?.toLowerCase().includes(search.toLowerCase()) ||
      d.state?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* New deal button */}
      <div className="px-3.5 pt-3.5 pb-2.5 flex-shrink-0">
        <button
          onClick={() => router.push("/deals/new")}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] border border-[#2f5d5033] bg-[#2f5d5014] text-[#2f5d50] text-[13px] font-semibold hover:bg-[#2f5d501f] transition-colors cursor-pointer"
        >
          <Plus size={14} strokeWidth={2.5} />
          New deal · upload files
        </button>
      </div>

      {/* Search */}
      <div className="px-2.5 pb-1.5 flex-shrink-0">
        <div className="flex items-center gap-2 bg-[#f4f2eb] border border-[#eae6dd] rounded-[9px] px-3 py-2">
          <Search size={13} className="text-[#b3aea3] flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals…"
            className="bg-transparent text-[12.5px] text-[#23211d] placeholder-[#b3aea3] outline-none flex-1 min-w-0"
          />
        </div>
      </div>

      {/* Deal list */}
      <div className="flex-1 overflow-y-auto">
        <div className="text-[10.5px] font-bold tracking-[0.06em] uppercase text-[#9b978f] px-4 pt-2.5 pb-1.5">
          Opportunities · {deals.length}{" "}
          {deals.length === 1 ? "deal" : "deals"}
        </div>

        {isLoadingDeals ? (
          <div className="flex flex-col gap-[3px] px-2 pb-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-[74px] rounded-[10px] bg-[#f4f2eb] animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[12px] text-[#b3aea3]">
              {search ? "No deals match your search." : "No deals yet."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-[3px] px-2 pb-3">
            {filtered.map((deal) => (
              <DealItem key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
