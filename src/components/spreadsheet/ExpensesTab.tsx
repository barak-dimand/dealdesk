"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useDealStore } from "@/store/dealStore";
import { SpreadsheetEngine } from "./core/SpreadsheetEngine";
import { buildProvenance } from "@/lib/provenance";
import type { DealDataField } from "@/types";

let fieldSeq = 0;
function nextFieldKey(prefix: string): string {
  fieldSeq += 1;
  return `${prefix}_${Date.now()}_${fieldSeq}`;
}

function dollars(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

export function ExpensesTab() {
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
        .filter((f) => f.category === "expense")
        .sort((a, b) => a.sort_order - b.sort_order),
    [dataFields]
  );

  const grossIncome = useMemo(
    () =>
      dataFields
        .filter((f) => f.category === "income")
        .reduce((s, f) => s + (f.field_value_numeric ?? 0), 0),
    [dataFields]
  );

  const totalExpenses = useMemo(
    () => rows.reduce((s, f) => s + (f.field_value_numeric ?? 0), 0),
    [rows]
  );

  const columns = useMemo<ColumnDef<DealDataField, unknown>[]>(
    () => [
      {
        id: "label",
        header: "Expense",
        accessorKey: "field_label",
        size: 220,
        meta: { type: "text", required: true },
        cell: ({ getValue }) => (
          <span style={{ fontWeight: 500 }}>{String(getValue() ?? "")}</span>
        ),
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
        id: "monthly",
        header: "Monthly",
        accessorFn: (f) =>
          f.field_value_numeric != null ? Math.round(f.field_value_numeric / 12) : null,
        size: 110,
        meta: { type: "number", align: "right", editable: false },
        cell: ({ getValue }) => dollars(getValue() as number | null),
      },
      {
        id: "pct_egi",
        header: "% of EGI",
        accessorFn: (f) =>
          grossIncome > 0 && f.field_value_numeric != null
            ? (f.field_value_numeric / grossIncome) * 100
            : null,
        size: 90,
        meta: { type: "percent", align: "right", editable: false },
      },
      {
        id: "flagged",
        header: "Flagged",
        accessorFn: (f) =>
          grossIncome > 0 &&
          f.field_value_numeric != null &&
          f.field_value_numeric / grossIncome > 0.15
            ? "flagged"
            : "",
        size: 80,
        meta: { type: "status", editable: false },
        cell: ({ getValue, row }) =>
          getValue() === "flagged" ? (
            <span
              title={`${row.original.field_label} exceeds 15% of income — verify with invoices`}
              style={{ color: "#9a6b3f" }}
            >
              ⚑
            </span>
          ) : null,
      },
    ],
    [grossIncome, docNames]
  );

  async function patchField(fieldId: string, updates: Record<string, unknown>) {
    updateDataField(fieldId, updates);
    await fetch(`/api/deals/${dealId}/data-fields/${fieldId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).catch(() => {});
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
    }
  }

  async function handleRowAdd() {
    const res = await fetch(`/api/deals/${dealId}/data-fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "expense",
        field_key: nextFieldKey("custom_expense"),
        field_label: "New expense line",
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

  const expenseRatio =
    grossIncome > 0 ? ((totalExpenses / grossIncome) * 100).toFixed(1) : null;

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
        label: "Total Expenses",
        annual: dollars(totalExpenses),
        monthly: dollars(totalExpenses / 12),
        pct_egi: expenseRatio != null ? `${expenseRatio}%` : "",
      }}
      dealId={dealId}
      onCellVerified={(rowIndex) => {
        const field = rows[rowIndex];
        if (field) updateDataField(field.id, { user_verified: true });
      }}
      tableId="expenses"
      dealName={activeDeal?.name}
      emptyState={
        <div className="text-center">
          <p className="text-[14px] font-semibold text-[#23211d] mb-1">No expense data yet</p>
          <p className="text-[12.5px] text-[#9b978f]">
            Upload a T12 or P&L, or add a line from the toolbar.
          </p>
        </div>
      }
    />
  );
}
