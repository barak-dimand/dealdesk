"use client";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LOITerm, LOITermConfidence } from "@/types";

const TERM_GROUPS: { label: string; ids: string[] }[] = [
  {
    label: "Offer Terms",
    ids: [
      "offer_price",
      "financing_structure",
      "down_payment",
      "loan_amount",
      "loan_term",
      "first_payment_deferral",
      "balloon_prepayment",
    ],
  },
  {
    label: "Transaction Terms",
    ids: ["earnest_money", "due_diligence_period", "closing_timeline", "contingencies"],
  },
  {
    label: "Parties",
    ids: [
      "buyer_name_entity",
      "seller_agent_name",
      "seller_agent_email",
      "commission_handling",
    ],
  },
];

function ConfidenceIcon({
  confidence,
  isRequired,
}: {
  confidence: LOITermConfidence;
  isRequired: boolean;
}) {
  if (confidence === "verified")
    return <span className="text-[11px] font-bold text-[#2f6d4f] flex-shrink-0">✓</span>;
  if (confidence === "inferred")
    return <span className="text-[11px] font-bold text-[#9a6b3f] flex-shrink-0">~</span>;
  // missing — red ✗ only for required fields; neutral dash for optional ones
  if (isRequired)
    return <span className="text-[11px] font-bold text-[#a8473a] flex-shrink-0">✗</span>;
  return <span className="text-[11px] font-bold text-[#b3aea3] flex-shrink-0">–</span>;
}

interface TermRowProps {
  term: LOITerm;
  onTermChange: (termId: string, newValue: string) => void;
  onReset: (termId: string) => void;
}

function TermRow({ term, onTermChange, onReset }: TermRowProps) {
  const isMissing = term.confidence === "missing";
  const showRequired = isMissing && term.is_required;

  return (
    <div className="relative group">
      {/* Label row */}
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#9b978f]">
          {term.label}
        </span>
        {term.source && (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                aria-label={`Source: ${term.source}`}
                className="text-[#b3aea3] hover:text-[#9b978f] transition-colors flex-shrink-0"
              >
                <Info size={10} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="bg-[#23211d] text-white text-[11px] px-2.5 py-1.5 rounded-[6px] shadow-md max-w-[200px] z-50"
                sideOffset={4}
              >
                {term.source}
                <Tooltip.Arrow className="fill-[#23211d]" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        )}
        <button
          type="button"
          onClick={() => onReset(term.id)}
          className="ml-auto text-[10.5px] text-[#2f5d50] underline hover:text-[#274e43] transition-all cursor-pointer opacity-0 group-hover:opacity-100"
        >
          Reset
        </button>
      </div>

      {/* Input + confidence indicator */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={term.value ?? ""}
          onChange={(e) => onTermChange(term.id, e.target.value)}
          placeholder={showRequired ? "Required — fill in" : ""}
          className={cn(
            "flex-1 text-[13px] text-[#23211d] border rounded-[8px] px-[10px] py-[7px] outline-none transition-colors bg-[#faf8f3]",
            showRequired
              ? "border-[#a8473a] focus:border-[#a8473a] placeholder:text-[#c8847e]"
              : "border-[#e6e3dc] focus:border-[#2f5d50]"
          )}
        />
        <ConfidenceIcon confidence={term.confidence} isRequired={term.is_required} />
      </div>

      {showRequired && (
        <div className="mt-0.5 text-[10.5px] text-[#a8473a]">Required</div>
      )}
    </div>
  );
}

interface LOITermPanelProps {
  terms: LOITerm[];
  onTermChange: (termId: string, newValue: string) => void;
  onReset: (termId: string) => void;
}

export function LOITermPanel({ terms, onTermChange, onReset }: LOITermPanelProps) {
  return (
    <Tooltip.Provider delayDuration={400}>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Panel header */}
        <div className="px-4 py-3 border-b border-[#e6e3dc] flex-shrink-0 bg-white">
          <div className="text-[13px] font-semibold text-[#23211d]">Key Terms</div>
          <div className="text-[11px] text-[#9b978f] mt-0.5">
            Edit any value to update the document
          </div>
        </div>

        {/* Scrollable term list */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col">
          {TERM_GROUPS.map((group, groupIdx) => {
            const groupTerms = group.ids
              .map((id) => terms.find((t) => t.id === id))
              .filter((t): t is LOITerm => t !== undefined);

            if (groupTerms.length === 0) return null;

            return (
              <div key={group.label}>
                {groupIdx > 0 && (
                  <div className="border-t border-[#e6e3dc] my-4" />
                )}
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#b3aea3] mb-3">
                  {group.label}
                </div>
                <div className="flex flex-col gap-4">
                  {groupTerms.map((term) => (
                    <TermRow
                      key={term.id}
                      term={term}
                      onTermChange={onTermChange}
                      onReset={onReset}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Tooltip.Provider>
  );
}
