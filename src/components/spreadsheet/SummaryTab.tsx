"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useDealStore } from "@/store/dealStore";
import { SpreadsheetEngine } from "./core/SpreadsheetEngine";
import { formatCentsFull, formatPercent } from "@/lib/utils";
import type { DealDataField } from "@/types";

interface SummaryRow {
  id: string;
  metric: string;
  value: string;
  note: string;
  source: "Calculated" | "Parsed from documents" | "User entered";
  fieldId: string | null;
  editable: boolean;
}

// Summary field_value is often stored as a raw number string (dollars) by the
// parse route — format for display
function formatSummaryValue(field: DealDataField): string {
  const raw = field.field_value;
  if (raw && !/^-?\d+(\.\d+)?$/.test(raw.trim())) return raw;
  const num = field.field_value_numeric ?? (raw != null ? Number(raw) : null);
  if (num == null || Number.isNaN(num)) return raw ?? "—";
  const key = field.field_key.toLowerCase();
  if (/(rate|ratio|percent|pct|vacancy)/.test(key)) return formatPercent(num);
  if (/(multiplier|grm|count|units|year)/.test(key)) return num.toLocaleString("en-US");
  return formatCentsFull(Math.round(num * 100));
}

export function SummaryTab() {
  const { activeDeal, dataFields, updateDataField } = useDealStore();
  const dealId = activeDeal?.id ?? "";
  const askingPrice = activeDeal?.asking_price ?? null;

  const rows = useMemo<SummaryRow[]>(() => {
    const incomeFields = dataFields.filter((f) => f.category === "income");
    const expenseFields = dataFields.filter((f) => f.category === "expense");
    const summaryFields = dataFields
      .filter((f) => f.category === "summary")
      .sort((a, b) => a.sort_order - b.sort_order);

    const grossIncome = incomeFields.reduce((s, f) => s + (f.field_value_numeric ?? 0), 0);
    const totalExpenses = expenseFields
      .filter((f) => !f.field_key.includes("total"))
      .reduce((s, f) => s + (f.field_value_numeric ?? 0), 0);
    const noi = grossIncome - totalExpenses;

    const calculated: SummaryRow[] = [];
    if (grossIncome > 0) {
      calculated.push(
        {
          id: "calc-goi",
          metric: "Gross operating income",
          value: `${formatCentsFull(grossIncome * 100)}/yr`,
          note: "",
          source: "Calculated",
          fieldId: null,
          editable: false,
        },
        {
          id: "calc-expenses",
          metric: "Total operating expenses",
          value: `${formatCentsFull(totalExpenses * 100)}/yr`,
          note: "",
          source: "Calculated",
          fieldId: null,
          editable: false,
        },
        {
          id: "calc-ratio",
          metric: "Expense ratio",
          value: formatPercent((totalExpenses / grossIncome) * 100),
          note: totalExpenses / grossIncome > 0.55 ? "Elevated — verify with T12" : "",
          source: "Calculated",
          fieldId: null,
          editable: false,
        },
        {
          id: "calc-noi",
          metric: "Reported NOI",
          value: `${formatCentsFull(noi * 100)}/yr`,
          note: "",
          source: "Calculated",
          fieldId: null,
          editable: false,
        }
      );
      if (askingPrice && noi > 0) {
        calculated.push({
          id: "calc-cap",
          metric: "Cap rate @ ask",
          value: formatPercent((noi / (askingPrice / 100)) * 100),
          note: "",
          source: "Calculated",
          fieldId: null,
          editable: false,
        });
      }
    }

    const fieldRows: SummaryRow[] = summaryFields.map((f) => ({
      id: f.id,
      metric: f.field_label,
      value: formatSummaryValue(f),
      note: f.ai_note ?? "",
      source: f.document_id ? "Parsed from documents" : "User entered",
      fieldId: f.id,
      editable: !f.document_id,
    }));

    return [...calculated, ...fieldRows];
  }, [dataFields, askingPrice]);

  const columns = useMemo<ColumnDef<SummaryRow, unknown>[]>(
    () => [
      {
        id: "metric",
        header: "Metric",
        accessorKey: "metric",
        size: 220,
        meta: { type: "text", editable: false },
        cell: ({ getValue }) => (
          <span style={{ fontWeight: 500 }}>{String(getValue() ?? "")}</span>
        ),
      },
      {
        id: "value",
        header: "Value",
        accessorKey: "value",
        size: 140,
        meta: { type: "text", align: "right" },
      },
      {
        id: "note",
        header: "Note",
        accessorKey: "note",
        size: 240,
        meta: { type: "text" },
      },
      {
        id: "source",
        header: "Source",
        accessorKey: "source",
        size: 160,
        meta: { type: "status", editable: false },
        cell: ({ getValue }) => (
          <span style={{ color: "#9b978f", fontSize: 11.5 }}>
            {String(getValue() ?? "")}
          </span>
        ),
      },
    ],
    []
  );

  async function handleCellChange(rowIndex: number, columnId: string, value: string | number | null) {
    const row = rows[rowIndex];
    // Calculated rows and parsed rows are read-only
    if (!row || !row.editable || !row.fieldId) return;
    const updates: Record<string, unknown> =
      columnId === "value"
        ? { field_value: value == null ? null : String(value) }
        : columnId === "note"
          ? { ai_note: value == null ? null : String(value) }
          : {};
    if (Object.keys(updates).length === 0) return;
    updateDataField(row.fieldId, updates);
    await fetch(`/api/deals/${dealId}/data-fields/${row.fieldId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).catch(() => {});
  }

  return (
    <SpreadsheetEngine<SummaryRow>
      columns={columns}
      data={rows}
      onCellChange={handleCellChange}
      frozenColumns={1}
      showRowNumbers
      dealId={dealId}
      tableId="summary"
      dealName={activeDeal?.name}
      emptyState={
        <div className="text-center">
          <p className="text-[14px] font-semibold text-[#23211d] mb-1">No summary data yet</p>
          <p className="text-[12.5px] text-[#9b978f]">
            Upload documents to populate this tab.
          </p>
        </div>
      }
    />
  );
}
