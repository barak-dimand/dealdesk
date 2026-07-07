"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDealStore } from "@/store/dealStore";
import { NewDealModal } from "@/components/deals/NewDealModal";
import { Chip } from "@/components/ui/Chip";
import { dealStatusLabel, dealTypeLabel, formatCentsFull } from "@/lib/utils";
import type { DealStatus } from "@/types";
import { Plus } from "lucide-react";

function statusTone(
  status: DealStatus
): "positive" | "negative" | "amber" | "blue" | "default" {
  if (status === "off_market") return "positive";
  if (status === "under_loi" || status === "under_contract") return "blue";
  if (status === "marketed") return "amber";
  if (status === "dead") return "negative";
  return "default";
}

export default function OpportunitiesPage() {
  const router = useRouter();
  const { deals, setDeals, setIsLoadingDeals } = useDealStore();
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadDeals() {
      setIsLoadingDeals(true);
      try {
        const res = await fetch("/api/deals");
        if (res.ok) {
          const { deals: fetchedDeals } = await res.json();
          setDeals(fetchedDeals ?? []);
        }
      } finally {
        setIsLoadingDeals(false);
        setLoaded(true);
      }
    }
    loadDeals();
  }, [setDeals, setIsLoadingDeals]);

  return (
    <div className="h-full overflow-y-auto bg-[#f6f5f1]">
      <div className="max-w-[900px] mx-auto px-6 py-8 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#23211d]">
              Opportunities
            </h1>
            <p className="text-[12.5px] text-[#9b978f] mt-0.5">
              Deals you&apos;re evaluating, negotiating, or closing.
            </p>
          </div>
          <button
            onClick={() => setShowNewDeal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2f5d50] text-white text-[13px] font-semibold rounded-[10px] hover:bg-[#274e43] transition-colors cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} />
            New opportunity
          </button>
        </div>

        {!loaded ? (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-[68px] rounded-[12px] bg-white border border-[#e6e3dc] animate-pulse" />
            ))}
          </div>
        ) : deals.length === 0 ? (
          <div className="bg-white border border-[#e6e3dc] rounded-[12px] py-16 text-center">
            <p className="text-[14px] font-semibold text-[#23211d] mb-1">
              No opportunities yet
            </p>
            <p className="text-[12.5px] text-[#9b978f]">
              Create your first deal and upload documents to start analyzing.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {deals.map((deal) => (
              <button
                key={deal.id}
                onClick={() => router.push(`/opportunities/${deal.id}`)}
                className="flex items-center gap-4 bg-white border border-[#e6e3dc] rounded-[12px] px-4 py-3.5 text-left hover:border-[#2f5d5060] hover:shadow-[0_2px_10px_rgba(40,35,25,0.06)] transition-all cursor-pointer"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-[14px] font-semibold text-[#23211d] truncate">
                    {deal.name}
                  </span>
                  <span className="text-[11.5px] text-[#9b978f]">
                    {[deal.city, deal.state].filter(Boolean).join(", ")}
                    {deal.unit_count ? ` · ${deal.unit_count} units` : ""}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[#8a857a] uppercase tracking-[0.03em] flex-shrink-0">
                  {dealTypeLabel(deal.deal_type)}
                </span>
                <Chip label={dealStatusLabel(deal.status)} tone={statusTone(deal.status)} />
                <span className="text-[13px] font-mono text-[#23211d] w-[110px] text-right flex-shrink-0">
                  {deal.asking_price ? formatCentsFull(deal.asking_price) : "—"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showNewDeal && <NewDealModal onClose={() => setShowNewDeal(false)} />}
    </div>
  );
}
