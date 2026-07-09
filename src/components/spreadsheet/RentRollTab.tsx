"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useDealStore } from "@/store/dealStore";
import { SpreadsheetEngine } from "./core/SpreadsheetEngine";
import { formatCents } from "@/lib/utils";
import { Chip } from "@/components/ui/Chip";
import type { DealUnit } from "@/types";

// Module scope — the React Compiler flags impure calls inside components
const NOW = Date.now();

function statusTone(status: string): "positive" | "negative" | "amber" | "blue" | "default" {
  if (status === "occupied") return "positive";
  if (status === "vacant") return "negative";
  if (status === "leased") return "blue";
  if (status === "credit") return "amber";
  return "default";
}

function StatusChip({ status }: { status: string }) {
  return <Chip label={status} tone={statusTone(status)} />;
}

// Column ids map 1:1 to deal_units API field names (delta is computed)
const EDITABLE_FIELDS = new Set([
  "unit_number",
  "unit_type",
  "current_rent",
  "market_rent",
  "status",
  "lease_start",
  "lease_end",
  "tenant_notes",
]);

const columns: ColumnDef<DealUnit, unknown>[] = [
  {
    id: "unit_number",
    header: "Unit",
    accessorKey: "unit_number",
    size: 80,
    meta: { type: "text", required: true },
    cell: ({ getValue }) => (
      <span style={{ fontWeight: 600 }}>{String(getValue() ?? "")}</span>
    ),
  },
  {
    id: "unit_type",
    header: "Type",
    accessorKey: "unit_type",
    size: 90,
    meta: { type: "text" },
  },
  {
    id: "current_rent",
    header: "In-Place Rent",
    accessorKey: "current_rent",
    size: 120,
    meta: { type: "currency", align: "right" },
    cell: ({ getValue }) => formatCents(getValue() as number | null) ?? "—",
  },
  {
    id: "market_rent",
    header: "Market Rent",
    accessorKey: "market_rent",
    size: 120,
    meta: { type: "currency", align: "right" },
    cell: ({ getValue }) => formatCents(getValue() as number | null) ?? "—",
  },
  {
    id: "delta",
    header: "Δ to Market",
    accessorFn: (row) => (row.market_rent ?? 0) - (row.current_rent ?? 0),
    size: 110,
    meta: { type: "delta", align: "right", editable: false },
    cell: ({ getValue }) => {
      const v = getValue() as number;
      const formatted = formatCents(Math.abs(v));
      return v > 0 ? (
        <span style={{ color: "#2f6d4f" }}>+{formatted}</span>
      ) : v < 0 ? (
        <span style={{ color: "#a8473a" }}>-{formatted}</span>
      ) : (
        <span style={{ color: "#9b978f" }}>—</span>
      );
    },
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    size: 110,
    meta: { type: "status" },
    cell: ({ getValue }) => <StatusChip status={String(getValue() ?? "")} />,
  },
  {
    id: "lease_start",
    header: "Lease Start",
    accessorKey: "lease_start",
    size: 110,
    meta: { type: "date" },
  },
  {
    id: "lease_end",
    header: "Lease End",
    accessorKey: "lease_end",
    size: 110,
    meta: { type: "date" },
    cell: ({ getValue }) => {
      const date = getValue() as string | null;
      if (!date) return <span style={{ color: "#9b978f" }}>—</span>;
      const daysUntil = Math.floor((new Date(date).getTime() - NOW) / 86400000);
      const color =
        daysUntil < 30 ? "#a8473a" : daysUntil < 90 ? "#9a6b3f" : "#2f6d4f";
      return <span style={{ color }}>{date}</span>;
    },
  },
  {
    id: "tenant_notes",
    header: "Notes",
    accessorKey: "tenant_notes",
    size: 200,
    meta: { type: "text" },
  },
];

export function RentRollTab() {
  const { activeDeal, units, updateUnit, addUnit, removeUnit } = useDealStore();
  const dealId = activeDeal?.id ?? "";

  const totals = useMemo(() => {
    const inPlace = units.reduce((s, u) => s + (u.current_rent ?? 0), 0);
    const market = units.reduce((s, u) => s + (u.market_rent ?? 0), 0);
    const vacant = units.filter((u) => u.status === "vacant").length;
    return {
      unit_number: `${units.length} units`,
      current_rent: formatCents(inPlace) ?? "",
      market_rent: formatCents(market) ?? "",
      delta: `${market - inPlace >= 0 ? "+" : "-"}${formatCents(Math.abs(market - inPlace))}`,
      status: `${vacant} vacant`,
    };
  }, [units]);

  // Group by building prefix (470-1 → "Building 470") — only when meaningful
  const shouldGroup = useMemo(() => {
    const prefixes = new Set(
      units
        .filter((u) => u.unit_number.includes("-"))
        .map((u) => u.unit_number.split("-")[0])
    );
    return prefixes.size >= 2;
  }, [units]);

  async function handleCellChange(
    rowIndex: number,
    columnId: string,
    value: string | number | null
  ) {
    const unit = units[rowIndex];
    if (!unit || !EDITABLE_FIELDS.has(columnId)) return;
    updateUnit(unit.id, { [columnId]: value });
    await fetch(`/api/deals/${dealId}/units/${unit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [columnId]: value }),
    }).catch(() => {});
  }

  async function handleRowAdd() {
    const res = await fetch(`/api/deals/${dealId}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unit_number: `New-${units.length + 1}` }),
    }).catch(() => null);
    if (res?.ok) {
      const { unit } = await res.json();
      if (unit) addUnit(unit);
    }
  }

  async function handleRowDelete(rowIndex: number) {
    const unit = units[rowIndex];
    if (!unit) return;
    removeUnit(unit.id);
    await fetch(`/api/deals/${dealId}/units/${unit.id}`, {
      method: "DELETE",
    }).catch(() => {});
  }

  return (
    <SpreadsheetEngine<DealUnit>
      columns={columns}
      data={units}
      onCellChange={handleCellChange}
      onRowAdd={handleRowAdd}
      onRowDelete={handleRowDelete}
      frozenColumns={1}
      showRowNumbers
      totalsRow={totals}
      dealId={dealId}
      tableId="rent-roll"
      dealName={activeDeal?.name}
      groupBy={
        shouldGroup
          ? (u) =>
              u.unit_number.includes("-")
                ? `Building ${u.unit_number.split("-")[0]}`
                : "Other"
          : undefined
      }
      groupSubtotal={(rows) =>
        `${formatCents(rows.reduce((s, u) => s + (u.current_rent ?? 0), 0))}/mo in-place`
      }
      emptyState={
        <div className="text-center">
          <p className="text-[14px] font-semibold text-[#23211d] mb-1">No units yet</p>
          <p className="text-[12.5px] text-[#9b978f]">
            Upload a rent roll or add a row from the toolbar.
          </p>
        </div>
      }
    />
  );
}
