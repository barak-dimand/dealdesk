"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useDealStore } from "@/store/dealStore";
import { SpreadsheetEngine } from "./core/SpreadsheetEngine";
import { buildProvenance } from "@/lib/provenance";
import type { DealDataField } from "@/types";

// Module scope so the React Compiler doesn't flag impure calls in components
let fieldSeq = 0;
function nextFieldKey(prefix: string): string {
  fieldSeq += 1;
  return `${prefix}_${Date.now()}_${fieldSeq}`;
}

function dollars(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

export function IncomeTab() {
  const { activeDeal, dataFields, documents, updateDataField, addDataField, removeDataField } =
    useDealStore();
  const docNames = useMemo(
    () => new Map(documents.map((d) => [d.id, d.name])),
    [documents]
  );
  const dealId = activeDeal?.id ?? "";

  const rows = useMemo(
    () =>
      dataFields
        .filter((f) => f.category === "income")
        .sort((a, b) => a.sort_order - b.sort_order),
    [dataFields]
  );

  const goi = useMemo(
    () => rows.reduce((s, f) => s + (f.field_value_numeric ?? 0), 0),
    [rows]
  );

  const columns = useMemo<ColumnDef<DealDataField, unknown>[]>(
    () => [
      {
        id: "label",
        header: "Label",
        accessorKey: "field_label",
        size: 220,
        meta: { type: "text", required: true },
        cell: ({ getValue }) => (
          <span style={{ fontWeight: 500 }}>{String(getValue() ?? "")}</span>
        ),
      },
      {
        id: "monthly",
        header: "Monthly",
        accessorFn: (f) =>
          f.field_value_numeric != null ? Math.round(f.field_value_numeric / 12) : null,
        size: 110,
        meta: { type: "number", align: "right", editable: false },
        cell: ({ getValue }) => dollars(getValue() as number | null),
      },
      {
        id: "annual",
        header: "Annual",
        accessorKey: "field_value_numeric",
        size: 120,
        meta: {
          type: "number",
          align: "right",
          getProvenance: (f) =>
            buildProvenance(
              f,
              f.source_document_id ? docNames.get(f.source_document_id) ?? null : null
            ),
          getVerifyTarget: (f) => ({ kind: "field" as const, id: f.id }),
        },
        cell: ({ getValue }) => dollars(getValue() as number | null),
      },
      {
        id: "pct_goi",
        header: "% of GOI",
        accessorFn: (f) =>
          goi > 0 && f.field_value_numeric != null
            ? (f.field_value_numeric / goi) * 100
            : null,
        size: 90,
        meta: { type: "percent", align: "right", editable: false },
      },
      {
        id: "notes",
        header: "Notes",
        accessorKey: "ai_note",
        size: 240,
        meta: { type: "text" },
      },
    ],
    [goi, docNames]
  );

  async function patchField(fieldId: string, updates: Record<string, unknown>) {
    updateDataField(fieldId, updates);
    const res = await fetch(`/api/deals/${dealId}/data-fields/${fieldId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).catch(() => null);
    if (res?.ok) {
      // Server response carries the new provenance (source_type: user_edited,
      // value_history, …) that drives the source dot
      const { field } = await res.json();
      if (field) updateDataField(fieldId, field);
    }
  }

  function handleCellChange(rowIndex: number, columnId: string, value: string | number | null) {
    const field = rows[rowIndex];
    if (!field) return;
    if (columnId === "label") {
      patchField(field.id, { field_label: String(value ?? "") });
    } else if (columnId === "annual") {
      const n = typeof value === "number" ? value : null;
      patchField(field.id, {
        field_value_numeric: n,
        field_value: n != null ? `$${n.toLocaleString("en-US")}/yr` : null,
      });
    } else if (columnId === "notes") {
      patchField(field.id, { ai_note: value == null ? null : String(value) });
    }
  }

  async function handleRowAdd() {
    const res = await fetch(`/api/deals/${dealId}/data-fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "income",
        field_key: nextFieldKey("custom_income"),
        field_label: "New income line",
      }),
    }).catch(() => null);
    if (res?.ok) {
      const { field } = await res.json();
      if (field) addDataField(field);
    }
  }

  async function handleRowDelete(rowIndex: number) {
    const field = rows[rowIndex];
    if (!field) return;
    removeDataField(field.id);
    await fetch(`/api/deals/${dealId}/data-fields/${field.id}`, {
      method: "DELETE",
    }).catch(() => {});
  }

  return (
    <SpreadsheetEngine<DealDataField>
      columns={columns}
      data={rows}
      onCellChange={handleCellChange}
      onRowAdd={handleRowAdd}
      onRowDelete={handleRowDelete}
      frozenColumns={1}
      showRowNumbers
      totalsRow={{
        label: "Gross Operating Income",
        monthly: dollars(goi / 12),
        annual: dollars(goi),
        pct_goi: "100%",
      }}
      dealId={dealId}
      onCellVerified={(rowIndex) => {
        const field = rows[rowIndex];
        if (field) updateDataField(field.id, { user_verified: true });
      }}
      tableId="income"
      dealName={activeDeal?.name}
      emptyState={
        <div className="text-center">
          <p className="text-[14px] font-semibold text-[#23211d] mb-1">No income data yet</p>
          <p className="text-[12.5px] text-[#9b978f]">
            Upload a T12 or rent roll, or add a line from the toolbar.
          </p>
        </div>
      }
    />
  );
}
