"use client";

import { useState } from "react";
import { Landmark, Plus, X } from "lucide-react";

export default function PortfolioPage() {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="h-full overflow-y-auto bg-[#f6f5f1]">
      <div className="max-w-[900px] mx-auto px-6 py-8 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#23211d]">
              Portfolio
            </h1>
            <p className="text-[12.5px] text-[#9b978f] mt-0.5">
              Assets you own and operate.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2f5d50] text-white text-[13px] font-semibold rounded-[10px] hover:bg-[#274e43] transition-colors cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} />
            Add asset manually
          </button>
        </div>

        <div className="bg-white border border-[#e6e3dc] rounded-[12px] py-20 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-[14px] bg-[#2f5d5014] flex items-center justify-center">
            <Landmark size={22} className="text-[#2f5d50]" />
          </div>
          <p className="text-[14px] font-semibold text-[#23211d]">No assets yet</p>
          <p className="text-[12.5px] text-[#9b978f]">
            Close an opportunity to add it to your portfolio.
          </p>
        </div>
      </div>

      {/* Stubbed add-asset modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[16px] w-full max-w-[440px] shadow-[0_24px_60px_rgba(40,35,25,0.22)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e6e3dc]">
              <span className="text-[15px] font-semibold">Add asset</span>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-[7px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-10 text-center text-[13px] text-[#9b978f]">
              Manual asset entry is coming soon.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
