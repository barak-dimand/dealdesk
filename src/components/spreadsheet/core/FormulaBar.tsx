"use client";

import { columnLetter, type CellPos } from "./types";

interface FormulaBarProps {
  selected: CellPos | null;
  /** Raw formula if the cell has one, otherwise the plain value */
  value: string;
  onCommit: (raw: string) => void;
  editing: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onCancel: () => void;
}

export function FormulaBar({
  selected,
  value,
  onCommit,
  editing,
  draft,
  onDraftChange,
  onStartEdit,
  onCancel,
}: FormulaBarProps) {
  const label = selected ? `${columnLetter(selected.c)}${selected.r + 1}` : "";

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border-b border-[#e6e3dc] flex-shrink-0">
      <div className="w-[52px] flex-shrink-0 text-center text-[11.5px] font-mono font-semibold text-[#6b6862] bg-[#f6f5f1] border border-[#e6e3dc] rounded-[6px] py-[3px]">
        {label || "—"}
      </div>
      <span className="text-[12px] text-[#b3aea3] italic flex-shrink-0">fx</span>
      <input
        type="text"
        aria-label="Formula bar"
        value={editing ? draft : value}
        disabled={!selected}
        onFocus={() => {
          if (selected && !editing) onStartEdit();
        }}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit(draft);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder={selected ? "" : "Select a cell"}
        className="flex-1 min-w-0 text-[12.5px] font-mono text-[#23211d] bg-transparent outline-none placeholder-[#b3aea3]"
      />
    </div>
  );
}
