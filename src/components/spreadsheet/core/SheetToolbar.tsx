"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Search,
  Download,
  Plus,
  Columns3,
  Rows3,
  Rows4,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDealStore } from "@/store/dealStore";
import { useSheetUiStore } from "./sheetUiStore";
import type { SheetTab } from "@/types";

const TABS: { key: SheetTab; label: string }[] = [
  { key: "rentroll", label: "Rent Roll" },
  { key: "income", label: "Income" },
  { key: "expenses", label: "Expenses" },
  { key: "summary", label: "Summary" },
];

export function SheetToolbar() {
  const { sheetTab, setSheetTab } = useDealStore();
  const { density, setDensity, engineApi } = useSheetUiStore();

  return (
    <div className="flex items-center gap-1 px-2.5 py-1.5 bg-white border-b border-[#e6e3dc] flex-shrink-0 overflow-x-auto">
      {/* Tab selector */}
      <div className="flex items-center gap-0.5 bg-[#f3f1ea] rounded-[9px] p-0.5">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSheetTab(key)}
            className={cn(
              "px-3 py-[5px] text-[12px] font-medium rounded-[7px] whitespace-nowrap cursor-pointer transition-colors",
              sheetTab === key
                ? "bg-white text-[#2f5d50] font-semibold shadow-[0_1px_3px_rgba(40,35,25,0.08)]"
                : "text-[#6b6862] hover:text-[#23211d]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Density toggle */}
      <div className="flex items-center gap-0.5 ml-2">
        <button
          onClick={() => setDensity("comfortable")}
          title="Comfortable density"
          aria-label="Comfortable density"
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded-[7px] transition-colors cursor-pointer",
            density === "comfortable"
              ? "bg-[#2f5d5014] text-[#2f5d50]"
              : "text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d]"
          )}
        >
          <Rows3 size={14} />
        </button>
        <button
          onClick={() => setDensity("compact")}
          title="Compact density"
          aria-label="Compact density"
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded-[7px] transition-colors cursor-pointer",
            density === "compact"
              ? "bg-[#2f5d5014] text-[#2f5d50]"
              : "text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d]"
          )}
        >
          <Rows4 size={14} />
        </button>
      </div>

      <div className="flex-1" />

      {/* Find */}
      <button
        onClick={() => engineApi?.openFind()}
        title="Find (Ctrl+F)"
        aria-label="Find in sheet"
        disabled={!engineApi}
        className="w-7 h-7 flex items-center justify-center rounded-[7px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d] disabled:opacity-40 transition-colors cursor-pointer"
      >
        <Search size={14} />
      </button>

      {/* Export */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            title="Export"
            aria-label="Export sheet"
            disabled={!engineApi}
            className="w-7 h-7 flex items-center justify-center rounded-[7px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d] disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Download size={14} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="bg-white border border-[#e6e3dc] rounded-[10px] shadow-[0_8px_24px_rgba(40,35,25,0.14)] py-1 min-w-[140px] z-50"
          >
            <DropdownMenu.Item
              onSelect={() => engineApi?.exportCsv()}
              className="px-3 py-1.5 text-[12.5px] text-[#3a3833] outline-none cursor-pointer data-[highlighted]:bg-[#f4f2eb]"
            >
              CSV
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => engineApi?.exportXlsx()}
              className="px-3 py-1.5 text-[12.5px] text-[#3a3833] outline-none cursor-pointer data-[highlighted]:bg-[#f4f2eb]"
            >
              Excel (.xlsx)
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Add row */}
      <button
        onClick={() => engineApi?.addRow?.()}
        title="Add row"
        aria-label="Add row"
        disabled={!engineApi?.addRow}
        className="w-7 h-7 flex items-center justify-center rounded-[7px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d] disabled:opacity-40 transition-colors cursor-pointer"
      >
        <Plus size={14} />
      </button>

      {/* Column visibility */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            title="Show/hide columns"
            aria-label="Column visibility"
            disabled={!engineApi}
            className="w-7 h-7 flex items-center justify-center rounded-[7px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d] disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Columns3 size={14} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="bg-white border border-[#e6e3dc] rounded-[10px] shadow-[0_8px_24px_rgba(40,35,25,0.14)] py-1 min-w-[170px] z-50"
          >
            {engineApi?.getColumnToggles().map((col) => (
              <DropdownMenu.CheckboxItem
                key={col.id}
                checked={col.visible}
                onCheckedChange={() => engineApi.toggleColumn(col.id)}
                onSelect={(e) => e.preventDefault()}
                className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-[#3a3833] outline-none cursor-pointer data-[highlighted]:bg-[#f4f2eb]"
              >
                <span className="w-3 text-[#2f5d50]">{col.visible ? "✓" : ""}</span>
                {col.label}
              </DropdownMenu.CheckboxItem>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
