"use client";

import { ChevronUp, ChevronDown, X } from "lucide-react";

interface FindBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  matchCount: number;
  activeMatch: number; // 0-based
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  showReplace: boolean;
  replaceValue: string;
  onReplaceValueChange: (v: string) => void;
  onReplace: () => void;
  onReplaceAll: () => void;
}

export function FindBar({
  query,
  onQueryChange,
  matchCount,
  activeMatch,
  onNext,
  onPrev,
  onClose,
  showReplace,
  replaceValue,
  onReplaceValueChange,
  onReplace,
  onReplaceAll,
}: FindBarProps) {
  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 bg-white border-b border-[#e6e3dc] shadow-[0_2px_8px_rgba(40,35,25,0.06)] flex-shrink-0">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          aria-label="Find in sheet"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) onPrev();
              else onNext();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder="Find in sheet…"
          className="w-[220px] text-[12.5px] border border-[#e6e3dc] rounded-[7px] px-2.5 py-1.5 outline-none focus:border-[#2f5d50] transition-colors"
        />
        <span className="text-[11.5px] text-[#9b978f] w-[90px]">
          {query ? `${matchCount === 0 ? 0 : activeMatch + 1} of ${matchCount}` : ""}
        </span>
        <button
          onClick={onPrev}
          disabled={matchCount === 0}
          aria-label="Previous match"
          className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[#6b6862] hover:bg-[#f4f2eb] disabled:opacity-40 cursor-pointer"
        >
          <ChevronUp size={13} />
        </button>
        <button
          onClick={onNext}
          disabled={matchCount === 0}
          aria-label="Next match"
          className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[#6b6862] hover:bg-[#f4f2eb] disabled:opacity-40 cursor-pointer"
        >
          <ChevronDown size={13} />
        </button>
        <div className="flex-1" />
        <button
          onClick={onClose}
          aria-label="Close find bar"
          className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d] cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      {showReplace && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            aria-label="Replace with"
            value={replaceValue}
            onChange={(e) => onReplaceValueChange(e.target.value)}
            placeholder="Replace with…"
            className="w-[220px] text-[12.5px] border border-[#e6e3dc] rounded-[7px] px-2.5 py-1.5 outline-none focus:border-[#2f5d50] transition-colors"
          />
          <button
            onClick={onReplace}
            disabled={matchCount === 0}
            className="px-2.5 py-1.5 text-[11.5px] font-medium border border-[#e6e3dc] rounded-[7px] text-[#6b6862] hover:bg-[#f4f2eb] disabled:opacity-40 cursor-pointer"
          >
            Replace
          </button>
          <button
            onClick={onReplaceAll}
            disabled={matchCount === 0}
            className="px-2.5 py-1.5 text-[11.5px] font-medium border border-[#e6e3dc] rounded-[7px] text-[#6b6862] hover:bg-[#f4f2eb] disabled:opacity-40 cursor-pointer"
          >
            Replace all
          </button>
        </div>
      )}
    </div>
  );
}
