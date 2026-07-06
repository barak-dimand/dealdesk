"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ChatProposal, ProposedChange } from "@/types";

function changeIcon(type: ProposedChange["type"]): string {
  switch (type) {
    case "loi_draft":
      return "📄";
    case "data_field":
    case "loi_term":
      return "$";
    case "unit":
      return "🏠";
    default:
      return "📋";
  }
}

interface ProposalCardProps {
  proposal: ChatProposal;
  onApply: (selectedChangeIds: string[]) => Promise<void> | void;
  onReject: () => Promise<void> | void;
}

export function ProposalCard({ proposal, onApply, onReject }: ProposalCardProps) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(proposal.changes.map((c) => c.id))
  );
  const [applying, setApplying] = useState(false);

  const allChecked = checked.size === proposal.changes.length;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setChecked(
      allChecked ? new Set() : new Set(proposal.changes.map((c) => c.id))
    );
  }

  async function handleApply() {
    if (checked.size === 0 || applying) return;
    setApplying(true);
    try {
      await onApply(Array.from(checked));
    } finally {
      setApplying(false);
    }
  }

  // ── Rejected: collapsed muted line ──
  if (proposal.status === "rejected") {
    return (
      <div className="text-[12px] text-[#9b978f] italic px-3 py-2 border border-[#eae6dd] rounded-[10px] bg-[#faf8f3]">
        Changes rejected
      </div>
    );
  }

  // ── Applied / partially applied: success state ──
  if (proposal.status === "applied" || proposal.status === "partially_applied") {
    const applied = proposal.changes.filter((c) =>
      proposal.appliedChangeIds.includes(c.id)
    );
    const skipped = proposal.changes.length - applied.length;
    return (
      <div className="bg-white border border-[#d4e3d9] rounded-xl p-3">
        <div className="text-[12.5px] font-semibold text-[#2f6d4f] mb-1.5">
          ✓ {applied.length} {applied.length === 1 ? "change" : "changes"} applied
          {skipped > 0 ? ` · ${skipped} skipped` : ""}
        </div>
        <ul className="flex flex-col gap-0.5">
          {applied.map((c) => (
            <li key={c.id} className="text-[12px] text-[#3a3833]">
              {changeIcon(c.type)} {c.label} → <strong>{c.newValue}</strong>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ── Pending: full card ──
  return (
    <div className="bg-white border border-[#2f5d5040] rounded-xl shadow-[0_4px_14px_rgba(40,35,25,0.08)] p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-[#23211d]">
          🔄 Proposed Changes
        </span>
        <span className="text-[10.5px] font-semibold px-2 py-[2px] rounded-full bg-[#2f5d5014] text-[#2f5d50]">
          {proposal.changes.length}{" "}
          {proposal.changes.length === 1 ? "change" : "changes"}
        </span>
        <div className="flex-1" />
        <button
          onClick={toggleAll}
          className="text-[11.5px] text-[#2f5d50] hover:underline cursor-pointer"
        >
          {allChecked ? "Deselect all" : "Select all"}
        </button>
      </div>

      {/* Change rows */}
      <div className="flex flex-col gap-2.5">
        {proposal.changes.map((change) => (
          <label
            key={change.id}
            className="flex items-start gap-2.5 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={checked.has(change.id)}
              onChange={() => toggle(change.id)}
              aria-label={`Include ${change.label}`}
              className="mt-[3px] accent-[#2f5d50] cursor-pointer"
            />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[13px] font-semibold text-[#23211d]">
                {changeIcon(change.type)} {change.label}
              </span>
              {change.type === "loi_draft" && change.payload.loiDraft ? (
                <div className="text-[12px] text-[#6b6862]">
                  Full LOI draft · {change.payload.loiDraft.sections.length}{" "}
                  sections · {change.payload.loiDraft.terms.length} terms
                  <p className="text-[11.5px] text-[#9b978f] italic mt-0.5">
                    {(change.payload.loiDraft.sections[0]?.content ?? "").slice(0, 80)}
                    {(change.payload.loiDraft.sections[0]?.content ?? "").length > 80 ? "…" : ""}
                  </p>
                </div>
              ) : (
                <div className="text-[12.5px] font-mono">
                  {change.oldValue != null && (
                    <>
                      <span className="line-through text-[#a8473a] opacity-80">
                        {change.oldValue}
                      </span>{" "}
                      <span className="text-[#9b978f]">→</span>{" "}
                    </>
                  )}
                  <span className="font-bold text-[#2f6d4f]">{change.newValue}</span>
                </div>
              )}
            </div>
          </label>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => onReject()}
          disabled={applying}
          className="text-[12px] text-[#9b978f] hover:text-[#a8473a] transition-colors cursor-pointer disabled:opacity-40"
        >
          Reject all
        </button>
        <button
          onClick={handleApply}
          disabled={checked.size === 0 || applying}
          className={cn(
            "px-4 py-2 text-[12.5px] font-semibold bg-[#2f5d50] text-white rounded-[8px] transition-colors",
            checked.size === 0 || applying
              ? "opacity-40 cursor-not-allowed"
              : "hover:bg-[#274e43] cursor-pointer"
          )}
        >
          {applying ? "Applying…" : `Apply selected (${checked.size})`}
        </button>
      </div>
    </div>
  );
}
