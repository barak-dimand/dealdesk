"use client";

import { useState, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Settings, X } from "lucide-react";

const BUYER_ENTITY_KEY = "dealdesk_buyer_entity";
const DD_PERIOD_KEY = "dealdesk_dd_period";

export function SettingsModal() {
  const [open, setOpen] = useState(false);
  const [buyerEntity, setBuyerEntity] = useState("");
  const [ddPeriod, setDdPeriod] = useState("30");
  const [saved, setSaved] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setBuyerEntity(localStorage.getItem(BUYER_ENTITY_KEY) ?? "");
      setDdPeriod(localStorage.getItem(DD_PERIOD_KEY) ?? "30");
      setSaved(false);
    }
  }, [open]);

  function handleSave() {
    localStorage.setItem(BUYER_ENTITY_KEY, buyerEntity.trim());
    const days = parseInt(ddPeriod, 10);
    localStorage.setItem(DD_PERIOD_KEY, String(isNaN(days) || days < 1 ? 30 : days));
    setSaved(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 1500);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          aria-label="Settings"
          className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d] transition-colors cursor-pointer"
        >
          <Settings size={18} />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[440px] bg-white rounded-[16px] shadow-[0_24px_60px_rgba(40,35,25,0.22)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#e6e3dc]">
            <Dialog.Title className="text-[15px] font-semibold text-[#23211d]">
              Settings
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="w-7 h-7 flex items-center justify-center rounded-[7px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d] transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="px-6 py-5 flex flex-col gap-5">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#b3aea3]">
              LOI Defaults
            </div>

            {/* Buyer entity */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">
                Buyer Name / Entity
              </label>
              <input
                type="text"
                value={buyerEntity}
                onChange={(e) => setBuyerEntity(e.target.value)}
                placeholder="e.g. Sunrise Capital LLC"
                className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
              />
              <p className="text-[11px] text-[#9b978f]">
                Pre-fills the Buyer field in every new LOI you generate.
              </p>
            </div>

            {/* DD period */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">
                Due Diligence Period
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={ddPeriod}
                  onChange={(e) => setDdPeriod(e.target.value)}
                  className="w-24 border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors"
                />
                <span className="text-[13px] text-[#9b978f]">days</span>
              </div>
              <p className="text-[11px] text-[#9b978f]">
                Default inspection period used in new LOIs (default: 30).
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e6e3dc]">
            <Dialog.Close asChild>
              <button className="px-4 py-2 text-[13px] text-[#6b6862] hover:text-[#23211d] transition-colors cursor-pointer">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              disabled={saved}
              className="px-5 py-2 text-[13px] font-semibold bg-[#2f5d50] text-white rounded-[9px] hover:bg-[#274e43] disabled:opacity-70 transition-colors cursor-pointer"
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
