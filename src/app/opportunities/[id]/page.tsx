"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { DealHeader } from "@/components/deals/DealHeader";
import { DealView } from "@/components/deals/DealView";
import { useDealStore } from "@/store/dealStore";

export default function DealPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    setDeals,
    setActiveDeal,
    setActiveDealId,
    setDocuments,
    setUnits,
    setDataFields,
    setMessages,
    setOfferStructures,
    setRecommendation,
    setIsGeneratingRec,
    setLOI,
    setProposals,
    setIsLoadingDeals,
    setIsLoadingDeal,
    documents,
  } = useDealStore();

  useEffect(() => {
    async function load() {
      setIsLoadingDeals(true);
      setIsLoadingDeal(true);
      // Clear previous deal's data immediately so stale content never renders
      setUnits([]);
      setDataFields([]);
      setMessages([]);
      setOfferStructures([]);
      setRecommendation(null);
      setLOI(null);
      setProposals([]);

      try {
        const [dealsRes, res] = await Promise.all([
          fetch("/api/deals"),
          fetch(`/api/deals/${id}`),
        ]);

        if (dealsRes.ok) {
          const { deals: all } = await dealsRes.json();
          setDeals(all ?? []);
        }

        if (!res.ok) {
          router.replace("/opportunities");
          return;
        }
        const data = await res.json();
        setActiveDeal(data.deal);
        setActiveDealId(id);
        setDocuments(data.documents ?? []);
        setUnits(data.units ?? []);
        setDataFields(data.dataFields ?? []);
        setMessages(data.messages ?? []);
        setOfferStructures(data.offerStructures ?? []);
        setRecommendation(data.recommendation ?? null);

        // Rehydrate proposals still awaiting review so ProposalCards
        // survive page reloads
        fetch(`/api/deals/${id}/chat`)
          .then((r) => (r.ok ? r.json() : null))
          .then((chatData) => {
            if (chatData?.pendingProposals) {
              setProposals(chatData.pendingProposals);
            }
          })
          .catch(() => {});

        // Auto-generate recommendation if deal has data but no existing recommendation
        const hasData = (data.dataFields ?? []).length > 0;
        const hasRec = !!(data.recommendation?.tier) && Array.isArray(data.recommendation?.scenarios) && data.recommendation.scenarios.length > 0;
        if (hasData && !hasRec) {
          setIsGeneratingRec(true);
          fetch(`/api/deals/${id}/recommend`, { method: "POST" })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d?.recommendation) setRecommendation(d.recommendation); })
            .catch(() => {})
            .finally(() => setIsGeneratingRec(false));
        }
      } finally {
        setIsLoadingDeals(false);
        setIsLoadingDeal(false);
      }
    }
    load();
    // Zustand setters and router are stable references
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Poll for parse completion while any document is pending/parsing
  const parsingDocKey = documents
    .filter((d) => d.status === "pending" || d.status === "parsing")
    .map((d) => d.id)
    .sort()
    .join(",");

  useEffect(() => {
    if (!parsingDocKey) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/deals/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setDocuments(data.documents ?? []);
        setUnits(data.units ?? []);
        setDataFields(data.dataFields ?? []);
        setOfferStructures(data.offerStructures ?? []);
        setRecommendation(data.recommendation ?? null);
      } catch {
        // ignore transient errors; next tick will retry
      }
    }, 3000);

    return () => clearTimeout(timer);
    // Zustand setters are stable references
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, parsingDocKey]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f6f5f1]">
      <DealHeader />
      <DealView />
    </div>
  );
}
