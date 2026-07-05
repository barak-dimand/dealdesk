"use client";

import { useState } from "react";
import { useDealStore } from "@/store/dealStore";
import { cn, formatCentsFull } from "@/lib/utils";
import { Pencil, Trash2, Plus, Loader2, X } from "lucide-react";
import type { DealUnit } from "@/types";

type UnitStatus = "occupied" | "vacant" | "leased" | "credit" | "other";

interface UnitForm {
  unit_number: string;
  unit_type: string;
  current_rent: string;
  market_rent: string;
  status: UnitStatus;
  bedrooms: string;
  bathrooms: string;
  tenant_notes: string;
}

const EMPTY_FORM: UnitForm = {
  unit_number: "",
  unit_type: "",
  current_rent: "",
  market_rent: "",
  status: "occupied",
  bedrooms: "",
  bathrooms: "",
  tenant_notes: "",
};

const UNIT_STATUSES: { value: UnitStatus; label: string }[] = [
  { value: "occupied", label: "Occupied" },
  { value: "vacant", label: "Vacant" },
  { value: "leased", label: "Leased" },
  { value: "credit", label: "Credit" },
  { value: "other", label: "Other" },
];

function UnitModal({
  dealId,
  existing,
  onClose,
  onSave,
}: {
  dealId: string;
  existing: DealUnit | null;
  onClose: () => void;
  onSave: (unit: DealUnit) => void;
}) {
  const [form, setForm] = useState<UnitForm>(
    existing
      ? {
          unit_number: existing.unit_number,
          unit_type: existing.unit_type ?? "",
          current_rent:
            existing.current_rent != null
              ? String(existing.current_rent / 100)
              : "",
          market_rent:
            existing.market_rent != null
              ? String(existing.market_rent / 100)
              : "",
          status: existing.status,
          bedrooms: existing.bedrooms != null ? String(existing.bedrooms) : "",
          bathrooms: existing.bathrooms != null ? String(existing.bathrooms) : "",
          tenant_notes: existing.tenant_notes ?? "",
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function parseDollars(s: string): number | null {
    if (!s.trim()) return null;
    const n = parseFloat(s.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : Math.round(n * 100);
  }

  async function handleSubmit() {
    if (!form.unit_number.trim()) {
      setError("Unit number is required.");
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      unit_number: form.unit_number.trim(),
      unit_type: form.unit_type.trim() || null,
      current_rent: parseDollars(form.current_rent),
      market_rent: parseDollars(form.market_rent),
      status: form.status,
      bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
      bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : null,
      tenant_notes: form.tenant_notes.trim() || null,
    };

    try {
      let res: Response;
      if (existing) {
        res = await fetch(`/api/deals/${dealId}/units/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/deals/${dealId}/units`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      onSave(data.unit);
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[14px] w-full max-w-[460px] shadow-[0_20px_50px_rgba(40,35,25,0.2)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e6e3dc]">
          <span className="text-[14px] font-semibold">
            {existing ? "Edit unit" : "Add unit"}
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-[7px] text-[#9b978f] hover:bg-[#f4f2eb] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="text-[12px] text-[#a8473a] bg-[#f5eaea] border border-[#ecd4d4] rounded-[7px] px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">
                Unit # <span className="text-[#a8473a]">*</span>
              </label>
              <input
                autoFocus
                value={form.unit_number}
                onChange={(e) => setForm((f) => ({ ...f, unit_number: e.target.value }))}
                placeholder="1A"
                className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">
                Type
              </label>
              <input
                value={form.unit_type}
                onChange={(e) => setForm((f) => ({ ...f, unit_type: e.target.value }))}
                placeholder="2BR/1BA"
                className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">
                In-place rent ($/mo)
              </label>
              <input
                value={form.current_rent}
                onChange={(e) => setForm((f) => ({ ...f, current_rent: e.target.value }))}
                placeholder="700"
                className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">
                Market rent ($/mo)
              </label>
              <input
                value={form.market_rent}
                onChange={(e) => setForm((f) => ({ ...f, market_rent: e.target.value }))}
                placeholder="850"
                className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[#3a3833]">
              Status
            </label>
            <div className="flex flex-wrap gap-1.5">
              {UNIT_STATUSES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setForm((f) => ({ ...f, status: value }))}
                  className={cn(
                    "text-[12px] px-3 py-[6px] rounded-[8px] border transition-colors cursor-pointer",
                    form.status === value
                      ? "bg-[#2f5d50] text-white border-[#2f5d50]"
                      : "border-[#e6e3dc] text-[#6b6862] hover:border-[#2f5d5060] hover:text-[#23211d]"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">
                Bedrooms
              </label>
              <input
                type="number"
                value={form.bedrooms}
                onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))}
                placeholder="2"
                className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">
                Bathrooms
              </label>
              <input
                type="number"
                step="0.5"
                value={form.bathrooms}
                onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))}
                placeholder="1"
                className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[#3a3833]">
              Tenant notes
            </label>
            <input
              value={form.tenant_notes}
              onChange={(e) => setForm((f) => ({ ...f, tenant_notes: e.target.value }))}
              placeholder="Month-to-month, long-term tenant…"
              className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
            />
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
            disabled={saving || !form.unit_number.trim()}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#2f5d50] text-white rounded-[9px] hover:bg-[#274e43] disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
            {existing ? "Save" : "Add unit"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RentRollTab() {
  const { activeDeal, units, addUnit, updateUnit, removeUnit } =
    useDealStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editingUnit, setEditingUnit] = useState<DealUnit | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalCurrentRent = units.reduce(
    (sum, u) => sum + (u.current_rent ?? 0),
    0
  );
  const totalMarketRent = units.reduce(
    (sum, u) => sum + (u.market_rent ?? 0),
    0
  );
  const upside = totalMarketRent - totalCurrentRent;
  const vacantCount = units.filter(
    (u) => u.status === "vacant" || u.status === "leased"
  ).length;

  async function handleDelete(unit: DealUnit) {
    if (!activeDeal) return;
    setDeletingId(unit.id);
    try {
      await fetch(`/api/deals/${activeDeal.id}/units/${unit.id}`, {
        method: "DELETE",
      });
      removeUnit(unit.id);
    } finally {
      setDeletingId(null);
    }
  }

  if (units.length === 0) {
    return (
      <>
        {showAdd && activeDeal && (
          <UnitModal
            dealId={activeDeal.id}
            existing={null}
            onClose={() => setShowAdd(false)}
            onSave={(u) => { addUnit(u); setShowAdd(false); }}
          />
        )}
        <div className="flex items-center justify-center h-full py-16 text-center px-8">
          <div>
            <p className="text-[14px] font-semibold text-[#23211d] mb-1">
              No rent roll data yet
            </p>
            <p className="text-[12px] text-[#9b978f] mb-4">
              Upload a rent roll PDF, CSV, or spreadsheet — or enter units manually.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-[#2f5d50] border border-[#2f5d5033] bg-[#2f5d5010] rounded-[9px] hover:bg-[#2f5d5020] transition-colors"
            >
              <Plus size={14} />
              Add unit
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {(showAdd || editingUnit) && activeDeal && (
        <UnitModal
          dealId={activeDeal.id}
          existing={editingUnit}
          onClose={() => { setShowAdd(false); setEditingUnit(null); }}
          onSave={(u) => {
            if (editingUnit) updateUnit(u.id, u);
            else addUnit(u);
            setShowAdd(false);
            setEditingUnit(null);
          }}
        />
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {[
              { label: "Unit", sticky: true },
              { label: "Type" },
              { label: "In-place Rent", align: "right" },
              { label: "Market", align: "right" },
              { label: "Δ to Market", align: "right" },
              { label: "Status" },
              { label: "Notes" },
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
          {units.map((unit) => {
            const diff = (unit.market_rent ?? 0) - (unit.current_rent ?? 0);
            const isVacant = unit.status === "vacant";
            const isCredit = unit.status === "credit";
            const isLeased = unit.status === "leased";

            return (
              <tr
                key={unit.id}
                className="group border-b border-[#efece4] hover:bg-[#faf8f3] transition-colors"
              >
                <td className="sticky left-0 z-10 px-[13px] py-[9px] text-[13px] font-semibold text-[#33312c] whitespace-nowrap bg-white border-r border-[#efece4] shadow-[1px_0_0_#efece4]">
                  {unit.unit_number}
                </td>
                <td className="px-[13px] py-[9px] text-[12px] text-[#9b978f] whitespace-nowrap">
                  {unit.unit_type ?? "—"}
                </td>
                <td className="px-[13px] py-[9px] text-[13px] font-mono text-right whitespace-nowrap">
                  {isVacant ? (
                    <span className="text-[#9b978f]">—</span>
                  ) : isCredit ? (
                    <span className="text-[#9a6b3f]">
                      {unit.current_rent != null
                        ? formatCentsFull(unit.current_rent)
                        : "—"}
                    </span>
                  ) : (
                    formatCentsFull(unit.current_rent)
                  )}
                </td>
                <td className="px-[13px] py-[9px] text-[13px] font-mono text-right text-[#9b978f] whitespace-nowrap">
                  {formatCentsFull(unit.market_rent)}
                </td>
                <td className="px-[13px] py-[9px] text-[13px] font-mono text-right whitespace-nowrap">
                  {diff > 0 ? (
                    <span className="text-[#2f6d4f]">
                      +{formatCentsFull(diff)}
                    </span>
                  ) : diff === 0 ? (
                    <span className="text-[#9b978f]">$0</span>
                  ) : (
                    <span className="text-[#a8473a]">
                      {formatCentsFull(diff)}
                    </span>
                  )}
                </td>
                <td className="px-[13px] py-[9px] whitespace-nowrap">
                  <span
                    className={cn(
                      "text-[11px] font-semibold px-2 py-[3px] rounded-[5px]",
                      isVacant && "bg-[#f5eaea] text-[#a8473a]",
                      isLeased && "bg-[#eaf1ec] text-[#2f6d4f]",
                      isCredit && "bg-[#f7efe6] text-[#9a6b3f]",
                      !isVacant && !isLeased && !isCredit &&
                        "bg-[#f1efe8] text-[#6b6862]"
                    )}
                  >
                    {isVacant
                      ? "Vacant"
                      : isLeased
                      ? "Leased"
                      : isCredit
                      ? "Credit"
                      : "Occupied"}
                  </span>
                </td>
                <td className="px-[13px] py-[9px] text-[12px] text-[#9b978f] whitespace-nowrap max-w-[180px] overflow-hidden text-ellipsis">
                  {unit.tenant_notes ?? ""}
                </td>
                <td className="px-[10px] py-[9px] whitespace-nowrap">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingUnit(unit)}
                      className="p-1 rounded-[5px] text-[#9b978f] hover:text-[#3a3833] hover:bg-[#f0ede6] transition-colors"
                      title="Edit"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(unit)}
                      disabled={deletingId === unit.id}
                      className="p-1 rounded-[5px] text-[#9b978f] hover:text-[#a8473a] hover:bg-[#f5eaea] transition-colors"
                      title="Delete"
                    >
                      {deletingId === unit.id ? (
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
              Totals · {units.length} units
            </td>
            <td />
            <td className="px-[13px] py-[9px] text-[13px] font-bold font-mono text-right">
              {formatCentsFull(totalCurrentRent)}/mo
            </td>
            <td className="px-[13px] py-[9px] text-[13px] font-bold font-mono text-right text-[#9b978f]">
              {formatCentsFull(totalMarketRent)}/mo
            </td>
            <td className="px-[13px] py-[9px] text-[13px] font-bold font-mono text-right text-[#2f6d4f]">
              +{formatCentsFull(upside)}/mo
            </td>
            <td className="px-[13px] py-[9px] text-[11.5px] text-[#9b978f]">
              {vacantCount > 0 ? `${vacantCount} vacant` : ""}
            </td>
            <td />
            <td />
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={8} className="px-[13px] py-[8px]">
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 text-[12px] text-[#2f5d50] font-semibold hover:text-[#274e43] transition-colors"
              >
                <Plus size={13} />
                Add unit
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}
