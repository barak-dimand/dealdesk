"use client";

import { useState } from "react";
import { useDealStore } from "@/store/dealStore";
import { cn } from "@/lib/utils";
import type { Deal, DealType, DealStatus } from "@/types";
import { X, Loader2 } from "lucide-react";

const DEAL_TYPES: { value: DealType; label: string }[] = [
  { value: "multifamily", label: "Multifamily" },
  { value: "commercial", label: "Commercial" },
  { value: "retail", label: "Retail" },
  { value: "storage", label: "Self-Storage" },
  { value: "industrial", label: "Industrial" },
  { value: "office", label: "Office" },
  { value: "mixed_use", label: "Mixed Use" },
  { value: "residential", label: "Residential" },
  { value: "land", label: "Land" },
  { value: "hotel", label: "Hotel" },
];

const DEAL_STATUSES: { value: DealStatus; label: string }[] = [
  { value: "evaluating", label: "Evaluating" },
  { value: "off_market", label: "Off Market" },
  { value: "marketed", label: "Marketed" },
  { value: "under_loi", label: "Under LOI" },
  { value: "under_contract", label: "Under Contract" },
  { value: "closed", label: "Closed" },
  { value: "dead", label: "Dead" },
];

function centsToDisplay(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function EditDealModal({
  deal,
  onClose,
}: {
  deal: Deal;
  onClose: () => void;
}) {
  const { updateDeal } = useDealStore();

  const [name, setName] = useState(deal.name);
  const [address, setAddress] = useState(deal.address ?? "");
  const [city, setCity] = useState(deal.city ?? "");
  const [state, setState] = useState(deal.state ?? "");
  const [dealType, setDealType] = useState<DealType>(deal.deal_type);
  const [status, setStatus] = useState<DealStatus>(deal.status);
  const [askingPrice, setAskingPrice] = useState(
    centsToDisplay(deal.asking_price)
  );
  const [unitCount, setUnitCount] = useState(
    deal.unit_count != null ? String(deal.unit_count) : ""
  );
  const [sqft, setSqft] = useState(
    deal.sqft != null ? String(deal.sqft) : ""
  );
  const [yearBuilt, setYearBuilt] = useState(
    deal.year_built != null ? String(deal.year_built) : ""
  );
  const [description, setDescription] = useState(deal.description ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!name.trim()) {
      setError("Deal name is required.");
      return;
    }
    setIsSaving(true);
    setError("");

    const body = {
      name: name.trim(),
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      deal_type: dealType,
      status,
      asking_price: askingPrice
        ? Math.round(parseFloat(askingPrice.replace(/[^0-9.]/g, "")) * 100)
        : null,
      unit_count: unitCount ? parseInt(unitCount) : null,
      sqft: sqft ? parseInt(sqft) : null,
      year_built: yearBuilt ? parseInt(yearBuilt) : null,
      description: description.trim() || null,
    };

    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to update deal");
      const { deal: updated } = await res.json();
      updateDeal(deal.id, updated);
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[16px] w-full max-w-[520px] shadow-[0_24px_60px_rgba(40,35,25,0.22)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e6e3dc]">
          <span className="text-[15px] font-semibold">Edit deal</span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-[7px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4 max-h-[72vh] overflow-y-auto">
          {error && (
            <div className="text-[12.5px] text-[#a8473a] bg-[#f5eaea] border border-[#ecd4d4] rounded-[8px] px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[#3a3833]">
              Deal name <span className="text-[#a8473a]">*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[#3a3833]">
              Street address
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St"
              className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">
                City
              </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Sharon"
                className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">
                State
              </label>
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="PA"
                className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[#3a3833]">
              Deal type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DEAL_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDealType(value)}
                  className={cn(
                    "text-[12px] px-3 py-[6px] rounded-[8px] border transition-colors cursor-pointer",
                    dealType === value
                      ? "bg-[#2f5d50] text-white border-[#2f5d50]"
                      : "border-[#e6e3dc] text-[#6b6862] hover:border-[#2f5d5060] hover:text-[#23211d]"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[#3a3833]">
              Status
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DEAL_STATUSES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatus(value)}
                  className={cn(
                    "text-[12px] px-3 py-[6px] rounded-[8px] border transition-colors cursor-pointer",
                    status === value
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
                Asking price
              </label>
              <input
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                placeholder="$1,125,000"
                className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">
                Units / tenants
              </label>
              <input
                type="number"
                value={unitCount}
                onChange={(e) => setUnitCount(e.target.value)}
                placeholder="18"
                className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">
                Sq. footage
              </label>
              <input
                type="number"
                value={sqft}
                onChange={(e) => setSqft(e.target.value)}
                placeholder="14,400"
                className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">
                Year built
              </label>
              <input
                type="number"
                value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)}
                placeholder="1972"
                className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[#3a3833]">
              Notes / description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any notes about this deal…"
              rows={3}
              className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e6e3dc]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-[#6b6862] hover:text-[#23211d] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="flex items-center gap-2 px-5 py-2 text-[13px] font-semibold bg-[#2f5d50] text-white rounded-[9px] hover:bg-[#274e43] disabled:opacity-40 transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
