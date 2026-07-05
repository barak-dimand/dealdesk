"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDealStore } from "@/store/dealStore";
import { cn, formatFileSize } from "@/lib/utils";
import type { DealDocument, DealUnit, DealDataField } from "@/types";

interface ParseReviewModalProps {
  document: DealDocument;
  dealId: string;
  open: boolean;
  onClose: () => void;
}

type WarningCategory = "opportunity" | "risk" | "verify" | "info";

export function categorizeWarning(text: string): WarningCategory {
  const t = text.toLowerCase();
  if (t.includes("vacant") || t.includes("vacancy")) return "opportunity";
  if (t.includes("below market") || t.includes("upside")) return "opportunity";
  if (t.includes("elevated") || t.includes("exceeds") || t.includes("flag")) return "risk";
  if (t.includes("mismatch") || t.includes("verify") || t.includes("confirm")) return "verify";
  return "info";
}

export function whatToDo(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("vacant") || t.includes("vacancy"))
    return "Request move-out date and make-ready timeline from seller";
  if (t.includes("below market") || t.includes("upside"))
    return "Pull comparable rents for this market before submitting LOI";
  if (t.includes("repair") || t.includes("r&m") || t.includes("maintenance"))
    return "Request 3 years of repair & maintenance invoices and receipts";
  if (t.includes("mismatch") || t.includes("unit count"))
    return "Ask seller for complete unit list with addresses";
  if (t.includes("credit") || t.includes("non-standard") || t.includes("lease"))
    return "Request copy of lease for this unit";
  return "Verify with seller before closing";
}

const WARNING_STYLE: Record<
  WarningCategory,
  { border: string; badge: string; label: string }
> = {
  opportunity: { border: "#2f6d4f", badge: "bg-[#eaf1ec] text-[#2f6d4f]", label: "💡 Opportunity" },
  risk:        { border: "#a8473a", badge: "bg-[#f5eaea] text-[#a8473a]", label: "⚠️ Risk" },
  verify:      { border: "#9a6b3f", badge: "bg-[#f7efe6] text-[#9a6b3f]", label: "✓ Verify" },
  info:        { border: "#9b978f", badge: "bg-[#f1efe8] text-[#6b6862]", label: "ℹ️ Note" },
};

function WarningCard({ warning }: { warning: string }) {
  const category = categorizeWarning(warning);
  const style = WARNING_STYLE[category];
  return (
    <div
      className="bg-white border border-[#e6e3dc] border-l-[3px] rounded-[8px] p-3"
      style={{ borderLeftColor: style.border }}
    >
      <span className={cn("inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] mb-1.5", style.badge)}>
        {style.label}
      </span>
      <p className="text-[12px] text-[#3a3833] leading-[1.5]">{warning}</p>
      <p className="text-[11.5px] text-[#6b6862] mt-1.5 leading-[1.4]">
        <span className="font-semibold text-[#2f5d50]">What to do:</span> {whatToDo(warning)}
      </p>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" | null }) {
  if (!confidence) return null;
  const map = {
    high:   { cls: "bg-[#eaf1ec] text-[#2f6d4f]", label: "✓ High confidence" },
    medium: { cls: "bg-[#f7efe6] text-[#9a6b3f]", label: "~ Medium confidence" },
    low:    { cls: "bg-[#f5eaea] text-[#a8473a]",  label: "⚑ Low confidence" },
  };
  const { cls, label } = map[confidence];
  return (
    <span className={cn("text-[10.5px] font-semibold px-2 py-[2px] rounded-full", cls)}>
      {label}
    </span>
  );
}

function FieldGroup({ label, fields }: { label: string; fields: DealDataField[] }) {
  if (fields.length === 0) return null;
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#b3aea3] mb-2">
        {label}
      </div>
      <div className="flex flex-col">
        {fields.map((f) => (
          <div
            key={f.id}
            className="flex items-start justify-between gap-2 py-[7px] border-b border-[#f4f2eb] last:border-0"
          >
            <div className="flex flex-col min-w-0">
              <span className="text-[12.5px] text-[#3a3833]">{f.field_label}</span>
              {f.ai_note && (
                <span className="text-[11px] text-[#9a6b3f] italic leading-[1.4]">
                  {f.ai_note}
                </span>
              )}
            </div>
            <span className="text-[13px] font-mono text-[#23211d] flex-shrink-0">
              {f.field_value ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ParseReviewModal({
  document: doc,
  dealId,
  open,
  onClose,
}: ParseReviewModalProps) {
  const { units, dataFields, updateDocumentStatus, updateDocument } = useDealStore();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  const docUnits = units.filter((u) => u.document_id === doc.id);
  const docFields = dataFields.filter((f) => f.document_id === doc.id);
  const incomeFields = docFields.filter((f) => f.category === "income");
  const expenseFields = docFields.filter((f) => f.category === "expense");
  const summaryFields = docFields.filter((f) => f.category === "summary");
  const warnings = doc.parse_warnings ?? [];
  const hasAnyData =
    docUnits.length > 0 ||
    incomeFields.length > 0 ||
    expenseFields.length > 0 ||
    summaryFields.length > 0;

  useEffect(() => {
    if (open && doc.file_type === "image" && doc.storage_path) {
      setImageLoading(true);
      fetch(`/api/deals/${dealId}/documents/${doc.id}/url`)
        .then((r) => r.json())
        .then((data) => setImageUrl(data.url ?? null))
        .catch(() => setImageUrl(null))
        .finally(() => setImageLoading(false));
    }
  }, [open, doc.id, doc.file_type, doc.storage_path, dealId]);

  function handleReparse() {
    updateDocumentStatus(doc.id, "parsing");
    onClose();
    toast("Re-parsing document…", { description: "Results will appear in the file list when complete." });

    void fetch(`/api/deals/${dealId}/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: doc.id }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.parsed) {
            updateDocument(doc.id, {
              status: "parsed",
              parsed_at: new Date().toISOString(),
              document_type: data.parsed.documentType ?? null,
              parse_confidence: data.parsed.parse_confidence ?? null,
              parse_warnings: data.parsed.warnings ?? null,
              extracted_unit_count: data.parsed.unitCount ?? null,
              extracted_field_count: data.parsed.fieldCount ?? null,
            });
          }
        } else {
          updateDocumentStatus(doc.id, "error");
          toast.error("Re-parse failed", { description: "Please try again." });
        }
      })
      .catch(() => {
        updateDocumentStatus(doc.id, "error");
        toast.error("Re-parse failed", { description: "Please try again." });
      });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-[1100px] bg-white rounded-[16px] shadow-[0_24px_60px_rgba(40,35,25,0.24)] overflow-hidden flex flex-col" style={{ height: "80vh" }}>

          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-[#e6e3dc] flex-shrink-0">
            <div className="flex flex-col gap-1.5 min-w-0">
              <Dialog.Title className="text-[15px] font-semibold text-[#23211d] truncate">
                {doc.name}
              </Dialog.Title>
              <div className="flex items-center gap-2 flex-wrap">
                <ConfidenceBadge confidence={doc.parse_confidence ?? null} />
                {doc.document_type && (
                  <span className="text-[10.5px] text-[#9b978f] uppercase tracking-[0.06em]">
                    {doc.document_type.replace(/_/g, " ")}
                  </span>
                )}
                {doc.extracted_unit_count != null && doc.extracted_unit_count > 0 && (
                  <span className="text-[10.5px] text-[#9b978f]">
                    {doc.extracted_unit_count} units
                  </span>
                )}
                {doc.extracted_field_count != null && doc.extracted_field_count > 0 && (
                  <span className="text-[10.5px] text-[#9b978f]">
                    {doc.extracted_field_count} fields
                  </span>
                )}
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-[7px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d] transition-colors cursor-pointer ml-4">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Two-column body */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* Left — Source (45%) */}
            <div className="flex flex-col flex-shrink-0 border-r border-[#e6e3dc] overflow-hidden" style={{ width: "45%" }}>
              <div className="px-4 py-2 border-b border-[#e6e3dc] flex-shrink-0 bg-[#faf8f3]">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#b3aea3]">
                  Source · {doc.file_type.toUpperCase()}
                  {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ""}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {doc.file_type === "image" ? (
                  imageLoading ? (
                    <div className="flex items-center justify-center h-full gap-2 text-[#9b978f] text-[13px]">
                      <Loader2 size={16} className="animate-spin" />
                      Loading image…
                    </div>
                  ) : imageUrl ? (
                    <img src={imageUrl} alt={doc.name} className="max-w-full rounded-[8px]" />
                  ) : (
                    <p className="text-[12px] text-[#b3aea3] italic">Image not available.</p>
                  )
                ) : doc.raw_text ? (
                  <pre className="text-[11.5px] text-[#3a3833] whitespace-pre-wrap font-mono leading-[1.65] break-words">
                    {doc.raw_text}
                  </pre>
                ) : (
                  <p className="text-[12px] text-[#b3aea3] italic">No source text available.</p>
                )}
              </div>
            </div>

            {/* Right — Extracted data (55%) */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

              {/* Warnings — categorized with What-to-do suggestions */}
              {warnings.length > 0 && (
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#9a6b3f] mb-2">
                    {warnings.length} {warnings.length === 1 ? "Warning" : "Warnings"}
                  </div>
                  <div className="flex flex-col gap-2">
                    {warnings.map((w, i) => (
                      <WarningCard key={i} warning={w} />
                    ))}
                  </div>
                </div>
              )}

              {/* Units table */}
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#b3aea3] mb-2">
                  Units Extracted · {docUnits.length}
                </div>
                {docUnits.length === 0 ? (
                  <p className="text-[12px] text-[#b3aea3] italic">
                    No units found in this document.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-[8px] border border-[#e6e3dc]">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="bg-[#faf8f3] border-b border-[#e6e3dc]">
                          <th className="text-left px-3 py-2 font-semibold text-[#6b6862]">Unit</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#6b6862]">Type</th>
                          <th className="text-right px-3 py-2 font-semibold text-[#6b6862]">Rent</th>
                          <th className="text-right px-3 py-2 font-semibold text-[#6b6862]">Market</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#6b6862]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docUnits.map((u) => (
                          <tr key={u.id} className="border-b border-[#f4f2eb] last:border-0">
                            <td className="px-3 py-2 font-medium">{u.unit_number}</td>
                            <td className="px-3 py-2 text-[#9b978f]">{u.unit_type ?? "—"}</td>
                            <td className="px-3 py-2 text-right font-mono">
                              {u.current_rent != null ? `$${(u.current_rent / 100).toLocaleString()}` : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-[#9b978f]">
                              {u.market_rent != null ? `$${(u.market_rent / 100).toLocaleString()}` : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <span className={cn(
                                "text-[10px] font-semibold px-1.5 py-[2px] rounded-[4px]",
                                u.status === "occupied" ? "bg-[#eaf1ec] text-[#2f6d4f]" :
                                u.status === "vacant"   ? "bg-[#f5eaea] text-[#a8473a]" :
                                "bg-[#f1efe8] text-[#6b6862]"
                              )}>
                                {u.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <FieldGroup label="Income" fields={incomeFields} />
              <FieldGroup label="Expenses" fields={expenseFields} />
              <FieldGroup label="Summary Metrics" fields={summaryFields} />

              {!hasAnyData && warnings.length === 0 && (
                <p className="text-[12px] text-[#b3aea3] italic">
                  No data was extracted from this document.
                </p>
              )}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#e6e3dc] bg-[#faf8f3] flex-shrink-0">
            <button
              onClick={handleReparse}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold border border-[#e6e3dc] text-[#6b6862] rounded-[9px] hover:bg-[#f4f2eb] hover:text-[#23211d] transition-colors cursor-pointer"
            >
              <RefreshCw size={13} />
              Re-parse
            </button>

            {doc.parse_confidence === "low" && (
              <p className="text-[11.5px] text-[#9a6b3f] text-center px-4">
                ⚠️ Low confidence — consider re-uploading a cleaner version
              </p>
            )}

            <Dialog.Close asChild>
              <button className="px-5 py-2 text-[13px] font-semibold bg-[#2f5d50] text-white rounded-[9px] hover:bg-[#274e43] transition-colors cursor-pointer">
                Looks good
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
