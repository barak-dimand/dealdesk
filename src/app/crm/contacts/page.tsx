"use client";

import { useState } from "react";
import { Users, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const CONTACT_TYPES = ["All", "Investor", "Lender", "Broker", "Seller", "Contractor"] as const;

export default function ContactsPage() {
  const [filter, setFilter] = useState<(typeof CONTACT_TYPES)[number]>("All");
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="h-full overflow-y-auto bg-[#f6f5f1]">
      <div className="max-w-[1000px] mx-auto px-6 py-8 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#23211d]">
              Contacts
            </h1>
            <p className="text-[12.5px] text-[#9b978f] mt-0.5">
              Everyone in your deal network.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2f5d50] text-white text-[13px] font-semibold rounded-[10px] hover:bg-[#274e43] transition-colors cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} />
            Add contact
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {CONTACT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors cursor-pointer flex-shrink-0",
                filter === type
                  ? "bg-[#2f5d50] text-white"
                  : "bg-white text-[#6b6862] border border-[#e6e3dc] hover:bg-[#f4f2eb]"
              )}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Table shell */}
        <div className="bg-white border border-[#e6e3dc] rounded-[12px] overflow-hidden">
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1.5fr] gap-2 px-4 py-2.5 bg-[#faf8f3] border-b border-[#e6e3dc] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#9b978f]">
            <span>Name</span>
            <span>Type tags</span>
            <span>Last contacted</span>
            <span>Linked deals</span>
            <span>Phone / Email</span>
          </div>
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-[14px] bg-[#2f5d5014] flex items-center justify-center">
              <Users size={22} className="text-[#2f5d50]" />
            </div>
            <p className="text-[14px] font-semibold text-[#23211d]">No contacts yet</p>
            <p className="text-[12.5px] text-[#9b978f]">Add your first contact.</p>
          </div>
        </div>
      </div>

      {/* Stubbed add-contact modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[16px] w-full max-w-[440px] shadow-[0_24px_60px_rgba(40,35,25,0.22)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e6e3dc]">
              <span className="text-[15px] font-semibold">Add contact</span>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-[7px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-10 text-center text-[13px] text-[#9b978f]">
              Contact creation is coming soon.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
