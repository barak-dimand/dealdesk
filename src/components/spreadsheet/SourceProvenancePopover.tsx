"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DataProvenance, DataSourceType, ValueHistoryEntry } from "@/types";

const SOURCE_BADGE: Record<DataSourceType, { label: string; cls: string; dot: string }> = {
  ai_parsed:   { label: "📄 AI Parsed",   cls: "bg-[#eaf1ec] text-[#2f6d4f]", dot: "#2f6d4f" },
  ai_inferred: { label: "~ AI Inferred",  cls: "bg-[#f7efe6] text-[#9a6b3f]", dot: "#9a6b3f" },
  user_edited: { label: "✏️ User Edited", cls: "bg-[#e8edf5] text-[#2f5d8a]", dot: "#2f5d8a" },
  calculated:  { label: "∑ Calculated",   cls: "bg-[#f1efe8] text-[#6b6862]", dot: "#9b978f" },
};

export function sourceDotColor(prov: DataProvenance): string {
  if (prov.source_type === "user_edited") return "#2f5d8a";
  if (prov.source_type === "calculated") return "#9b978f";
  if (
    prov.source_type === "ai_inferred" ||
    prov.source_confidence === "medium" ||
    prov.source_confidence === "low"
  ) {
    return "#9a6b3f";
  }
  return "#2f6d4f";
}

function fmtDate(iso: string | null, withTime = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return withTime
    ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) +
        " at " +
        d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function historySourceLabel(entry: ValueHistoryEntry): string {
  if (entry.source_type === "user_edited") return "You";
  if (entry.note) return entry.note;
  if (entry.source_document_name) return `AI · ${entry.source_document_name}`;
  return entry.changed_by ?? "AI";
}

export interface SourceProvenancePopoverProps {
  open: boolean;
  onClose: () => void;
  anchor: { x: number; y: number };
  fieldLabel: string;
  value: string;
  provenance: DataProvenance;
  dealId: string;
  verifyTarget?: { kind: "field" | "unit"; id: string } | null;
  onEdit?: () => void;
  onVerified?: () => void;
}

export function SourceProvenancePopover({
  open,
  onClose,
  anchor,
  fieldLabel,
  value,
  provenance,
  dealId,
  verifyTarget,
  onEdit,
  onVerified,
}: SourceProvenancePopoverProps) {
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [docUnavailable, setDocUnavailable] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const badge = SOURCE_BADGE[provenance.source_type];
  const isAiSource =
    provenance.source_type === "ai_parsed" || provenance.source_type === "ai_inferred";
  const history = provenance.value_history ?? [];
  const shownHistory = showAllHistory ? [...history].reverse() : [...history].reverse().slice(0, 5);

  async function openSourceDocument() {
    if (!provenance.source_document_id) {
      setDocUnavailable(true);
      return;
    }
    setLoadingUrl(true);
    try {
      const res = await fetch(
        `/api/deals/${dealId}/documents/${provenance.source_document_id}/url`
      );
      const data = res.ok ? await res.json() : null;
      if (data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        setDocUnavailable(true);
      }
    } catch {
      setDocUnavailable(true);
    } finally {
      setLoadingUrl(false);
    }
  }

  async function markVerified() {
    if (!verifyTarget || verifying) return;
    setVerifying(true);
    try {
      const path = verifyTarget.kind === "field" ? "data-fields" : "units";
      const res = await fetch(`/api/deals/${dealId}/${path}/${verifyTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_verified: true }),
      });
      if (res.ok) {
        onVerified?.();
        onClose();
      }
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Popover.Anchor asChild>
        <span
          style={{ position: "fixed", left: anchor.x, top: anchor.y, width: 0, height: 0 }}
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="bg-white border border-[#e6e3dc] rounded-[12px] shadow-[0_12px_32px_rgba(40,35,25,0.18)] p-4 w-[360px] max-w-[90vw] z-50 flex flex-col gap-3"
        >
          {/* Header */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-bold text-[#23211d] flex-1 min-w-0 truncate">
                {fieldLabel}
              </span>
              <span
                className={cn(
                  "text-[10.5px] font-semibold px-2 py-[3px] rounded-[6px] whitespace-nowrap flex-shrink-0",
                  badge.cls
                )}
              >
                {badge.label}
              </span>
            </div>
            <span className="text-[16px] font-mono font-semibold text-[#2f5d50]">
              {value}
            </span>
          </div>

          {/* Source section — AI-sourced values only */}
          {isAiSource && (
            <div className="flex flex-col gap-2 border-t border-[#f4f2eb] pt-3">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-[#23211d] flex-1 min-w-0 truncate">
                  {provenance.source_document_name ?? "Unknown document"}
                </span>
                {provenance.source_confidence && (
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-[2px] rounded-[5px] capitalize flex-shrink-0",
                      provenance.source_confidence === "high"
                        ? "bg-[#eaf1ec] text-[#2f6d4f]"
                        : provenance.source_confidence === "medium"
                          ? "bg-[#f7efe6] text-[#9a6b3f]"
                          : "bg-[#f5eaea] text-[#a8473a]"
                    )}
                  >
                    {provenance.source_confidence}
                  </span>
                )}
              </div>
              {provenance.last_edited_at == null && history.length > 0 && (
                <span className="text-[11px] text-[#9b978f]">
                  Parsed {fmtDate(history[history.length - 1]?.changed_at ?? null)}
                </span>
              )}
              {provenance.source_text_snippet && (
                <div className="bg-[#f6f5f1] rounded-[6px] p-2 text-[11px] font-mono text-[#3a3833] leading-[1.5] line-clamp-3 break-words">
                  {provenance.source_text_snippet}
                </div>
              )}
              {docUnavailable ? (
                <span className="text-[12px] text-[#9b978f] italic">
                  Document no longer available
                </span>
              ) : (
                <button
                  onClick={openSourceDocument}
                  disabled={loadingUrl}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-[#2f5d50] hover:underline cursor-pointer disabled:opacity-50 text-left"
                >
                  {loadingUrl && <Loader2 size={11} className="animate-spin" />}
                  Open source document →
                </button>
              )}
            </div>
          )}

          {/* User edit section */}
          {provenance.source_type === "user_edited" && (
            <div className="flex flex-col gap-1 border-t border-[#f4f2eb] pt-3">
              <span className="text-[12px] text-[#3a3833]">
                Manually edited by {provenance.last_edited_by ?? "you"}
              </span>
              {provenance.last_edited_at && (
                <span className="text-[11px] text-[#9b978f]">
                  {fmtDate(provenance.last_edited_at, true)}
                </span>
              )}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-[#f4f2eb] pt-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#9b978f]">
                History
              </span>
              {shownHistory.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 text-[11.5px]">
                  <span
                    className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                    style={{ background: SOURCE_BADGE[entry.source_type]?.dot ?? "#9b978f" }}
                  />
                  <span className="font-mono text-[#23211d]">{entry.value}</span>
                  <span className="text-[#6b6862] flex-1 min-w-0 truncate">
                    {historySourceLabel(entry)}
                  </span>
                  <span className="text-[11px] text-[#b3aea3] flex-shrink-0">
                    {fmtShortDate(entry.changed_at)}
                  </span>
                </div>
              ))}
              {!showAllHistory && history.length > 5 && (
                <button
                  onClick={() => setShowAllHistory(true)}
                  className="text-[11.5px] text-[#2f5d50] hover:underline cursor-pointer text-left"
                >
                  Show all {history.length} changes
                </button>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[#f4f2eb] pt-3">
            <button
              onClick={() => {
                onClose();
                onEdit?.();
              }}
              className="px-2.5 py-1 text-[11.5px] font-medium border border-[#e6e3dc] rounded-[7px] text-[#6b6862] hover:bg-[#f4f2eb] hover:text-[#23211d] transition-colors cursor-pointer"
            >
              Edit value
            </button>
            {verifyTarget && !provenance.user_verified && (
              <button
                onClick={markVerified}
                disabled={verifying}
                className="px-2.5 py-1 text-[11.5px] font-medium border border-[#d4e3d9] rounded-[7px] text-[#2f6d4f] hover:bg-[#eaf1ec] transition-colors cursor-pointer disabled:opacity-50"
              >
                {verifying ? "Verifying…" : "Mark as verified ✓"}
              </button>
            )}
            {provenance.user_verified && (
              <span className="text-[11.5px] text-[#2f6d4f] font-medium">✓ Verified</span>
            )}
          </div>

          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
