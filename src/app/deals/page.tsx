"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DealHeader } from "@/components/deals/DealHeader";
import { DealView } from "@/components/deals/DealView";
import { NewDealModal } from "@/components/deals/NewDealModal";
import { useDealStore } from "@/store/dealStore";
import { Brand } from "@/components/ui/Brand";
import { Plus } from "lucide-react";

export default function DealsPage() {
  const router = useRouter();
  const { setDeals, setActiveDeal, setActiveDealId, setIsLoadingDeals, deals } =
    useDealStore();
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
          if (fetchedDeals?.length > 0) {
            setActiveDeal(fetchedDeals[0]);
            setActiveDealId(fetchedDeals[0].id);
            router.replace(`/deals/${fetchedDeals[0].id}`);
          }
        }
      } finally {
        setIsLoadingDeals(false);
        setLoaded(true);
      }
    }
    loadDeals();
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f6f5f1]">
      <DealHeader />
      {loaded && deals.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <Brand size="lg" showName={false} />
          <div className="text-center">
            <h2 className="text-[22px] font-bold tracking-[-0.02em] mb-2">
              Welcome to Dealdesk
            </h2>
            <p className="text-[14px] text-[#9b978f] max-w-[360px]">
              Create your first deal and upload documents — rent rolls, T12s,
              offer memos — to start analyzing.
            </p>
          </div>
          <button
            onClick={() => setShowNewDeal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-[#2f5d50] text-white text-[14px] font-semibold rounded-[10px] hover:bg-[#274e43] transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Create your first deal
          </button>
        </div>
      ) : !loaded ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#2f5d50] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <DealView />
      )}
      {showNewDeal && (
        <NewDealModal onClose={() => setShowNewDeal(false)} />
      )}
    </div>
  );
}
