"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { LOIVersion, LOISection } from "@/types";

type DiffPart = { type: "same" | "added" | "removed"; text: string };

// Simple LCS word diff — sections are short, O(n·m) is fine
export function diffWords(oldText: string, newText: string): DiffPart[] {
  const a = oldText.split(/\s+/).filter(Boolean);
  const b = newText.split(/\s+/).filter(Boolean);
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      parts.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      parts.push({ type: "removed", text: a[i] });
      i++;
    } else {
      parts.push({ type: "added", text: b[j] });
      j++;
    }
  }
  while (i < m) parts.push({ type: "removed", text: a[i++] });
  while (j < n) parts.push({ type: "added", text: b[j++] });
  return parts;
}

function DiffText({ parts, side }: { parts: DiffPart[]; side: "left" | "right" }) {
  return (
    <p className="text-[12px] leading-[1.65] text-[#3a3833] whitespace-pre-wrap">
      {parts
        .filter((p) => (side === "left" ? p.type !== "added" : p.type !== "removed"))
        .map((p, i) => (
          <span
            key={i}
            className={
              p.type === "removed"
                ? "line-through text-[#a8473a] bg-[#f5eaea]"
                : p.type === "added"
                  ? "underline decoration-2 text-[#2f6d4f] bg-[#eaf1ec]"
                  : undefined
            }
          >
            {p.text}{" "}
          </span>
        ))}
    </p>
  );
}

interface LOICompareModalProps {
  open: boolean;
  onClose: () => void;
  left: LOIVersion;
  right: LOIVersion;
}

export function LOICompareModal({ open, onClose, left, right }: LOICompareModalProps) {
  // Union of section ids, ordered by the right (current) version
  const rightIds = right.sections.map((s) => s.id);
  const leftOnly = left.sections
    .map((s) => s.id)
    .filter((id) => !rightIds.includes(id));
  const sectionIds = [...rightIds, ...leftOnly];

  function sectionById(sections: LOISection[], id: string): LOISection | null {
    return sections.find((s) => s.id === id) ?? null;
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-[1200px] bg-white rounded-[16px] shadow-[0_24px_60px_rgba(40,35,25,0.24)] overflow-hidden flex flex-col"
          style={{ height: "84vh" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#e6e3dc] flex-shrink-0">
            <Dialog.Title className="text-[15px] font-semibold text-[#23211d]">
              Compare LOI Versions
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="w-7 h-7 flex items-center justify-center rounded-[7px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d] transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-2 divide-x divide-[#e6e3dc] border-b border-[#e6e3dc] bg-[#faf8f3] flex-shrink-0">
            <div className="px-5 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[#9b978f]">
              {left.label}
            </div>
            <div className="px-5 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[#2f5d50]">
              {right.label} (current)
            </div>
          </div>

          {/* Sections */}
          <div className="flex-1 overflow-y-auto">
            {sectionIds.map((id) => {
              const l = sectionById(left.sections, id);
              const r = sectionById(right.sections, id);
              const label = r?.label ?? l?.label ?? id;
              const identical = (l?.content ?? "") === (r?.content ?? "");

              if (identical) {
                return (
                  <div key={id} className="border-b border-[#f4f2eb] px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#b3aea3]">
                        {label}
                      </span>
                      <span className="text-[10.5px] text-[#b3aea3] italic">
                        Identical
                      </span>
                    </div>
                  </div>
                );
              }

              const parts = diffWords(l?.content ?? "", r?.content ?? "");
              return (
                <div key={id} className="border-b border-[#f4f2eb] bg-[#fdf6ec]">
                  <div className="px-5 pt-3 pb-1">
                    <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#9a6b3f]">
                      {label} — changed
                    </span>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-[#e6e3dc]">
                    <div className="px-5 py-3">
                      {l ? (
                        <DiffText parts={parts} side="left" />
                      ) : (
                        <p className="text-[11.5px] text-[#b3aea3] italic">
                          Not present in this version
                        </p>
                      )}
                    </div>
                    <div className="px-5 py-3">
                      {r ? (
                        <DiffText parts={parts} side="right" />
                      ) : (
                        <p className="text-[11.5px] text-[#b3aea3] italic">
                          Removed in this version
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
