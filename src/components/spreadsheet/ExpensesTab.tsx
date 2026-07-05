"use client";

import { useState } from "react";
import { useDealStore } from "@/store/dealStore";
import { cn, formatCentsFull } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Pencil, Trash2, Plus, Loader2, X } from "lucide-react";
import type { DealDataField } from "@/types";

interface FieldForm {
  field_label: string;
  field_value_numeric: string;
  field_period: "monthly" | "annual";
}

const EMPTY_FORM: FieldForm = {
  field_label: "",
  field_value_numeric: "",
  field_period: "annual",
};

function DataFieldModal({
  dealId,
  existing,
  onClose,
  onSave,
}: {
  dealId: string;
  existing: DealDataField | null;
  onClose: () => void;
  onSave: (field: DealDataField) => void;
}) {
  const [form, setForm] = useState<FieldForm>(
    existing
      ? {
          field_label: existing.field_label,
          field_value_numeric:
            existing.field_value_numeric != null
              ? String(existing.field_value_numeric)
              : "",
          field_period: (existing.field_period as "monthly" | "annual") ?? "annual",
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!form.field_label.trim()) {
      setError("Label is required.");
      return;
    }
    setSaving(true);
    setError("");

    const numericVal = form.field_value_numeric
      ? parseFloat(form.field_value_numeric.replace(/[^0-9.]/g, ""))
      : null;
    const annualVal =
      numericVal != null && form.field_period === "monthly"
        ? numericVal * 12
        : numericVal;

    try {
      let res: Response;
      if (existing) {
        res = await fetch(`/api/deals/${dealId}/data-fields/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field_label: form.field_label.trim(),
            field_value_numeric: annualVal,
            field_period: form.field_period,
          }),
        });
      } else {
        const key = form.field_label.trim().toLowerCase().replace(/\s+/g, "_");
        res = await fetch(`/api/deals/${dealId}/data-fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "expense",
            field_key: key,
            field_label: form.field_label.trim(),
            field_value_numeric: annualVal,
            field_period: form.field_period,
          }),
        });
      }

      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      onSave(data.field);
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[14px] w-full max-w-[380px] shadow-[0_20px_50px_rgba(40,35,25,0.2)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e6e3dc]">
          <span className="text-[14px] font-semibold">
            {existing ? "Edit expense item" : "Add expense item"}
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-[7px] text-[#9b978f] hover:bg-[#f4f2eb] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {error && (
            <div className="text-[12px] text-[#a8473a] bg-[#f5eaea] border border-[#ecd4d4] rounded-[7px] px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[#3a3833]">
              Expense label <span className="text-[#a8473a]">*</span>
            </label>
            <input
              autoFocus
              value={form.field_label}
              onChange={(e) => setForm((f) => ({ ...f, field_label: e.target.value }))}
              placeholder="e.g. Property Taxes"
              className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">
                Amount ($)
              </label>
              <input
                value={form.field_value_numeric}
                onChange={(e) =>
                  setForm((f) => ({ ...f, field_value_numeric: e.target.value }))
                }
                placeholder="12,000"
                className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">
                Period
              </label>
              <div className="flex gap-1.5">
                {(["monthly", "annual"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setForm((f) => ({ ...f, field_period: p }))}
                    className={cn(
                      "flex-1 py-2.5 text-[12px] rounded-[8px] border transition-colors cursor-pointer capitalize",
                      form.field_period === p
                        ? "bg-[#2f5d50] text-white border-[#2f5d50]"
                        : "border-[#e6e3dc] text-[#6b6862] hover:border-[#2f5d5060]"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#e6e3dc]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-[#6b6862] hover:text-[#23211d] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.field_label.trim()}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#2f5d50] text-white rounded-[9px] hover:bg-[#274e43] disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
            {existing ? "Save" : "Add expense"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExpensesTab() {
  const { activeDeal, dataFields, documents, addDataField, updateDataField, removeDataField } =
    useDealStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editingField, setEditingField] = useState<DealDataField | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const expenseFields = dataFields
    .filter((f) => f.category === "expense")
    .sort((a, b) => a.sort_order - b.sort_order);

  const totalExpenses = expenseFields
    .filter((f) => !f.field_key.includes("total"))
    .reduce((sum, f) => sum + (f.field_value_numeric ?? 0), 0);

  const totalIncome = dataFields
    .filter(
      (f) =>
        f.category === "income" &&
        (f.field_key.includes("gross") || f.field_key.includes("egi"))
    )
    .reduce((sum, f) => sum + (f.field_value_numeric ?? 0), 0);

  const expenseRatio =
    totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : null;

  const getSourceDoc = (docId: string | null) =>
    documents.find((d) => d.id === docId);

  async function handleDelete(field: DealDataField) {
    if (!activeDeal) return;
    setDeletingId(field.id);
    try {
      await fetch(`/api/deals/${activeDeal.id}/data-fields/${field.id}`, {
        method: "DELETE",
      });
      removeDataField(field.id);
    } finally {
      setDeletingId(null);
    }
  }

  if (expenseFields.length === 0) {
    return (
      <>
        {showAdd && activeDeal && (
          <DataFieldModal
            dealId={activeDeal.id}
            existing={null}
            onClose={() => setShowAdd(false)}
            onSave={(f) => { addDataField(f); setShowAdd(false); }}
          />
        )}
        <div className="flex items-center justify-center h-full py-16 text-center px-8">
          <div>
            <p className="text-[14px] font-semibold text-[#23211d] mb-1">
              No expense data yet
            </p>
            <p className="text-[12px] text-[#9b978f] mb-4">
              Upload a T12, P&L, or expense report — or enter manually.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-[#2f5d50] border border-[#2f5d5033] bg-[#2f5d5010] rounded-[9px] hover:bg-[#2f5d5020] transition-colors"
            >
              <Plus size={14} />
              Add expense item
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {(showAdd || editingField) && activeDeal && (
        <DataFieldModal
          dealId={activeDeal.id}
          existing={editingField}
          onClose={() => { setShowAdd(false); setEditingField(null); }}
          onSave={(f) => {
            if (editingField) updateDataField(f.id, f);
            else addDataField(f);
            setShowAdd(false);
            setEditingField(null);
          }}
        />
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {[
              { label: "Expense", sticky: true },
              { label: "Annual", align: "right" },
              { label: "% of EGI", align: "right" },
              { label: "Period" },
              { label: "Source" },
              { label: "" },
            ].map((h) => (
              <th
                key={h.label}
                className={cn(
                  "px-[13px] py-[9px] text-[11px] font-semibold text-[#7d7869] uppercase tracking-[0.03em] whitespace-nowrap border-b border-[#e6e3dc] bg-[#f3f1ea] text-left",
                  h.sticky && "sticky left-0 z-10 shadow-[1px_0_0_#e6e3dc]",
                  h.align === "right" && "text-right"
                )}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {expenseFields.map((field) => {
            const annual = field.field_value_numeric ?? 0;
            const pct = totalIncome > 0 ? (annual / totalIncome) * 100 : null;
            const sourceDoc = getSourceDoc(field.document_id);
            const isElevated = pct != null && pct > 15;

            return (
              <tr
                key={field.id}
                className="group border-b border-[#efece4] hover:bg-[#faf8f3] transition-colors"
              >
                <td className="sticky left-0 z-10 px-[13px] py-[9px] text-[13px] font-medium whitespace-nowrap bg-white border-r border-[#efece4] shadow-[1px_0_0_#efece4]">
                  <div className="flex items-center gap-1.5">
                    {(field.ai_note || isElevated) && (
                      <span
                        className="text-[#9a6b3f]"
                        title={field.ai_note ?? "Elevated expense"}
                      >
                        ⚑
                      </span>
                    )}
                    {field.field_label}
                  </div>
                </td>
                <td className="px-[13px] py-[9px] text-[13px] font-mono text-right whitespace-nowrap">
                  {annual > 0 ? formatCentsFull(annual * 100) : "—"}
                </td>
                <td
                  className={cn(
                    "px-[13px] py-[9px] text-[13px] font-mono text-right whitespace-nowrap",
                    isElevated ? "text-[#9a6b3f]" : "text-[#9b978f]"
                  )}
                >
                  {pct != null ? `${pct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-[13px] py-[9px] text-[11px] text-[#9b978f] capitalize">
                  {field.field_period ?? ""}
                </td>
                <td className="px-[13px] py-[9px]">
                  {sourceDoc && (
                    <div className="flex items-center gap-1">
                      {field.is_verified ? (
                        <CheckCircle2 size={12} className="text-[#2f6d4f]" />
                      ) : (
                        <AlertCircle size={12} className="text-[#9b978f]" />
                      )}
                      <span
                        className="text-[11px] text-[#9b978f] truncate max-w-[120px]"
                        title={sourceDoc.name}
                      >
                        {sourceDoc.name}
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-[10px] py-[9px] whitespace-nowrap">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingField(field)}
                      className="p-1 rounded-[5px] text-[#9b978f] hover:text-[#3a3833] hover:bg-[#f0ede6] transition-colors"
                      title="Edit"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(field)}
                      disabled={deletingId === field.id}
                      className="p-1 rounded-[5px] text-[#9b978f] hover:text-[#a8473a] hover:bg-[#f5eaea] transition-colors"
                      title="Delete"
                    >
                      {deletingId === field.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {/* Totals row */}
          <tr className="border-t-2 border-[#d9d4ca] bg-[#faf8f3]">
            <td className="sticky left-0 z-10 px-[13px] py-[9px] text-[13px] font-bold bg-[#faf8f3] shadow-[1px_0_0_#efece4]">
              Total operating expenses
            </td>
            <td className="px-[13px] py-[9px] text-[13px] font-bold font-mono text-right">
              {formatCentsFull(totalExpenses * 100)}
            </td>
            <td
              className={cn(
                "px-[13px] py-[9px] text-[13px] font-bold font-mono text-right",
                expenseRatio != null && expenseRatio > 60
                  ? "text-[#9a6b3f]"
                  : "text-[#9b978f]"
              )}
            >
              {expenseRatio != null ? `${expenseRatio.toFixed(1)}%` : "—"}
            </td>
            <td />
            <td />
            <td />
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} className="px-[13px] py-[8px]">
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 text-[12px] text-[#2f5d50] font-semibold hover:text-[#274e43] transition-colors"
              >
                <Plus size={13} />
                Add expense item
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}
