"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FileText } from "lucide-react";
import { useDealStore } from "@/store/dealStore";
import { useAutoTermSync } from "@/hooks/useAutoTermSync";
import { cn } from "@/lib/utils";
import { LOIToolbar } from "./LOIToolbar";
import { LOIDocument } from "./LOIDocument";
import { LOITermPanel } from "./LOITermPanel";
import { LOISendModal } from "./LOISendModal";
import type { LOIState, DealLOI, LOITerm, LOISection } from "@/types";

interface LOIBuilderProps {
  dealId: string;
  dealName: string;
  loiState: LOIState;
  loi: DealLOI | null;
}

export function LOIBuilder({ dealId, dealName, loiState, loi }: LOIBuilderProps) {
  const {
    setLOI,
    updateDeal,
    activeDeal,
    loiVersions,
    setLOIVersions,
    activeLoiVersionId,
    setActiveLoiVersionId,
  } = useDealStore();

  const [localLoiState, setLocalLoiState] = useState<LOIState>(loiState);
  const [localTerms, setLocalTerms] = useState<LOITerm[]>(loi?.terms ?? []);
  const [originalTerms, setOriginalTerms] = useState<LOITerm[]>(loi?.terms ?? []);
  const [showSendModal, setShowSendModal] = useState(false);
  const [toastEmail, setToastEmail] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sections: both state (for renders) and ref (for stable timer closures)
  const sectionsRef = useRef<LOISection[]>(loi?.sections ?? []);
  const [localSections, rawSetLocalSections] = useState<LOISection[]>(loi?.sections ?? []);

  function updateSections(updater: (prev: LOISection[]) => LOISection[]) {
    rawSetLocalSections((prev) => {
      const next = updater(prev);
      sectionsRef.current = next;
      return next;
    });
  }

  function replaceSections(sections: LOISection[]) {
    sectionsRef.current = sections;
    rawSetLocalSections(sections);
  }

  const sectionPatchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync loiState prop → local state (e.g. after poll refresh)
  useEffect(() => {
    setLocalLoiState(loiState);
  }, [loiState]);

  // Sync loi data when it loads into the store
  useEffect(() => {
    if (loi) {
      setLocalTerms(loi.terms);
      setOriginalTerms(loi.terms);
      replaceSections(loi.sections);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loi]);

  // Fetch LOI from API if deal state says it exists but store doesn't have it yet
  useEffect(() => {
    if ((loiState === "draft" || loiState === "sent") && loi === null) {
      fetch(`/api/deals/${dealId}/loi`)
        .then((r) => r.json())
        .then((data) => { if (data.loi) setLOI(data.loi); })
        .catch(() => {});
    }
  }, [dealId, loiState, loi, setLOI]);

  // Fetch all LOI versions for this deal
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/deals/${dealId}/loi/versions`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data.versions)) return;
        setLOIVersions(data.versions);
        if (data.versions.length > 0) {
          const currentActive = useDealStore.getState().activeLoiVersionId;
          const stillPresent = data.versions.some(
            (v: { id: string }) => v.id === currentActive
          );
          if (!stillPresent) {
            setActiveLoiVersionId(data.versions[data.versions.length - 1].id);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dealId, setLOIVersions, setActiveLoiVersionId]);

  // Load the active version's content into the editor when it changes
  useEffect(() => {
    const version = useDealStore
      .getState()
      .loiVersions.find((v) => v.id === activeLoiVersionId);
    if (version) {
      setLocalTerms(version.terms);
      setOriginalTerms(version.terms);
      replaceSections(version.sections);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLoiVersionId, loiVersions]);

  // Section/term PATCHes target the active version when one exists
  const getLoiPatchUrl = useCallback(() => {
    const activeId = useDealStore.getState().activeLoiVersionId;
    return activeId
      ? `/api/deals/${dealId}/loi/versions/${activeId}`
      : `/api/deals/${dealId}/loi`;
  }, [dealId]);

  // Generate
  async function handleGenerate() {
    setLocalLoiState("generating");
    const buyerEntity = localStorage.getItem("dealdesk_buyer_entity") || null;
    const ddRaw = localStorage.getItem("dealdesk_dd_period");
    const ddPeriod = ddRaw ? parseInt(ddRaw, 10) : null;
    try {
      const res = await fetch(`/api/deals/${dealId}/loi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(buyerEntity ? { buyer_entity: buyerEntity } : {}),
          ...(ddPeriod && !isNaN(ddPeriod) ? { dd_period: ddPeriod } : {}),
        }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      setLOI(data.loi);
      if (data.version) {
        setLOIVersions([...useDealStore.getState().loiVersions, data.version]);
        setActiveLoiVersionId(data.version.id);
      }
      updateDeal(dealId, { loi_state: "draft" });
      setLocalLoiState("draft");
    } catch {
      setLocalLoiState("none");
    }
  }

  // Section change from LOIDocument — debounced PATCH
  const handleSectionChange = useCallback(
    (sectionId: string, content: string) => {
      updateSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, content } : s))
      );
      if (sectionPatchTimer.current) clearTimeout(sectionPatchTimer.current);
      sectionPatchTimer.current = setTimeout(() => {
        fetch(getLoiPatchUrl(), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sections: sectionsRef.current }),
        });
      }, 1000);
    },
    // updateSections and sectionsRef are stable (ref + functional setter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dealId, getLoiPatchUrl]
  );

  const { syncTermChange, highlightedSectionId } = useAutoTermSync({
    dealId,
    terms: localTerms,
    sections: localSections,
    onSectionUpdate: handleSectionChange,
    getPatchUrl: getLoiPatchUrl,
  });

  function handleTermChange(termId: string, newValue: string) {
    const oldTerm = localTerms.find((t) => t.id === termId);
    const oldValue = oldTerm?.value ?? null;
    setLocalTerms((prev) =>
      prev.map((t) => (t.id === termId ? { ...t, value: newValue || null } : t))
    );
    syncTermChange(termId, newValue, oldValue);
  }

  function handleTermReset(termId: string) {
    const original = originalTerms.find((t) => t.id === termId);
    if (original) handleTermChange(termId, original.value ?? "");
  }

  function handleCopy() {
    const text = [...localSections]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => `${s.label.toUpperCase()}\n\n${s.content}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }

  function handleSendSuccess(to: string) {
    const sentAt = new Date().toISOString();
    updateDeal(dealId, { loi_state: "sent", loi_sent_at: sentAt, contact_email: to });
    setLocalLoiState("sent");
    setShowSendModal(false);
    setToastEmail(to);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastEmail(null), 4000);
  }

  function handleRevise() {
    setLocalLoiState("draft");
  }

  const requiredTermsMissing = localTerms.some(
    (t) => t.is_required && (!t.value || t.value.trim() === "")
  );

  const isEditorReady = localSections.length > 0;
  const showEditor = (localLoiState === "draft" || localLoiState === "sent") && isEditorReady;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">

      {/* ── STATE: none — CTA ── */}
      <div
        style={{
          display: localLoiState === "none" ? "flex" : "none",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="flex flex-col items-center gap-4 text-center max-w-[300px]">
          <div className="w-12 h-12 rounded-[14px] bg-[#2f5d5014] flex items-center justify-center">
            <FileText size={22} className="text-[#2f5d50]" />
          </div>
          <div>
            <div className="text-[15px] font-semibold text-[#23211d] mb-1.5">
              Generate LOI
            </div>
            <div className="text-[13px] text-[#9b978f] leading-[1.5]">
              AI drafts a complete LOI from your deal data
            </div>
          </div>
          <button
            onClick={handleGenerate}
            className="px-6 py-2.5 text-[13.5px] font-semibold bg-[#2f5d50] text-white rounded-[9px] hover:bg-[#274e43] transition-colors cursor-pointer"
          >
            Generate LOI
          </button>
        </div>
      </div>

      {/* ── STATE: generating — skeleton ── */}
      <div
        style={{
          display: localLoiState === "generating" ? "flex" : "none",
          flex: 1,
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Skeleton toolbar */}
        <div className="flex items-center gap-2 px-4 py-[9px] bg-white border-b border-[#e6e3dc] flex-shrink-0">
          <div className="h-7 w-16 bg-[#e6e3dc] rounded-[7px] animate-pulse" />
          <div className="h-7 w-28 bg-[#e6e3dc] rounded-[7px] animate-pulse" />
          <div className="flex-1" />
          <div className="h-7 w-20 bg-[#e6e3dc] rounded-[7px] animate-pulse" />
        </div>

        {/* Status message */}
        <div className="flex-shrink-0 text-center py-2 text-[11.5px] text-[#9b978f] bg-white border-b border-[#e6e3dc]">
          AI is drafting your LOI…
        </div>

        {/* Skeleton columns */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left 60% */}
          <div
            className="overflow-y-auto px-5 py-7 bg-[#efece4]"
            style={{ flex: "0 0 60%" }}
          >
            <div className="max-w-[760px] mx-auto bg-white border border-[#e6e3dc] rounded-[4px] shadow-sm px-[clamp(20px,5%,64px)] py-[52px] flex flex-col gap-5">
              {[82, 67, 91, 56, 74, 88, 61, 78].map((w, i) => (
                <div
                  key={i}
                  className="h-3.5 bg-[#e6e3dc] rounded animate-pulse"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          </div>

          {/* Right 40% */}
          <div
            className="border-l border-[#e6e3dc] overflow-y-auto p-4 flex flex-col gap-5"
            style={{ flex: "0 0 40%" }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="h-2.5 w-24 bg-[#e6e3dc] rounded animate-pulse" />
                <div className="h-8 w-full bg-[#e6e3dc] rounded-[7px] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── STATE: draft / sent — full editor ── */}
      <div
        style={{
          display: showEditor ? "flex" : "none",
          flex: 1,
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Version selector */}
        {loiVersions.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 py-2 bg-white border-b border-[#e6e3dc] overflow-x-auto flex-shrink-0">
            {loiVersions.map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveLoiVersionId(v.id)}
                className={cn(
                  "px-3 py-1 rounded-full text-[11.5px] font-medium whitespace-nowrap cursor-pointer transition-colors flex-shrink-0",
                  v.id === activeLoiVersionId
                    ? "bg-[#2f5d50] text-white"
                    : "text-[#6b6862] border border-[#e6e3dc] hover:bg-[#f4f2eb] hover:text-[#23211d]"
                )}
              >
                {v.label}
              </button>
            ))}
            <button
              onClick={handleGenerate}
              className="px-3 py-1 rounded-full text-[11.5px] font-medium whitespace-nowrap text-[#2f5d50] border border-dashed border-[#2f5d5060] hover:bg-[#2f5d500a] transition-colors cursor-pointer flex-shrink-0"
            >
              ＋ Generate new
            </button>
          </div>
        )}

        <LOIToolbar
          loiState={localLoiState}
          sentAt={activeDeal?.loi_sent_at ?? null}
          onCopy={handleCopy}
          onDownloadPDF={() => {}}
          onSend={() => setShowSendModal(true)}
          onRevise={handleRevise}
          requiredTermsMissing={requiredTermsMissing}
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left — document (60%) */}
          <div
            className="flex flex-col min-h-0 overflow-hidden"
            style={{ flex: "0 0 60%" }}
          >
            <LOIDocument
              sections={localSections}
              onSectionChange={handleSectionChange}
              highlightedSectionId={highlightedSectionId}
            />
          </div>

          {/* Column divider */}
          <div className="w-px bg-[#e6e3dc] flex-shrink-0" />

          {/* Right — term panel (40%) */}
          <div
            className="flex flex-col min-h-0 overflow-hidden"
            style={{ flex: "0 0 40%" }}
          >
            <LOITermPanel
              terms={localTerms}
              onTermChange={handleTermChange}
              onReset={handleTermReset}
            />
          </div>
        </div>
      </div>

      {/* Draft/sent state but LOI not loaded yet — loading indicator */}
      <div
        style={{
          display:
            (localLoiState === "draft" || localLoiState === "sent") && !isEditorReady
              ? "flex"
              : "none",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="text-[13px] text-[#9b978f]">Loading LOI…</div>
      </div>

      {/* Send modal — unmounts on close so state resets automatically */}
      {showSendModal && (
        <LOISendModal
          open={showSendModal}
          onClose={() => setShowSendModal(false)}
          onSuccess={handleSendSuccess}
          dealId={dealId}
          dealName={dealName}
          prefillEmail={activeDeal?.contact_email ?? null}
          prefillName={activeDeal?.contact_name ?? null}
        />
      )}

      {/* Toast */}
      {toastEmail && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-[#23211d] text-white text-[13px] font-medium px-4 py-2.5 rounded-[10px] shadow-lg pointer-events-none">
          <span className="text-[#6abf8e]">✓</span>
          LOI sent to {toastEmail}
        </div>
      )}
    </div>
  );
}
