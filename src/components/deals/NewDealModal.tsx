"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { useDealStore } from "@/store/dealStore";
import { cn, inferFileType } from "@/lib/utils";
import type { DealType, DealDocument } from "@/types";
import { X, Upload, File, Loader2 } from "lucide-react";

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

interface PendingFile {
  file: File;
  id: string;
}

export function NewDealModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { addDeal, addDocument } = useDealStore();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [dealType, setDealType] = useState<DealType>("multifamily");
  const [askingPrice, setAskingPrice] = useState("");
  const [unitCount, setUnitCount] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  const onDrop = useCallback((files: File[]) => {
    setPendingFiles((prev) => [
      ...prev,
      ...files.map((f) => ({ file: f, id: `${Date.now()}-${f.name}` })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/plain": [".txt"],
      "message/rfc822": [".eml"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
  });

  async function handleCreate() {
    if (!name.trim()) {
      setError("Deal name is required.");
      return;
    }
    setIsCreating(true);
    setError("");

    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          deal_type: dealType,
          asking_price: askingPrice
            ? Math.round(parseFloat(askingPrice.replace(/[^0-9.]/g, "")) * 100)
            : null,
          unit_count: unitCount ? parseInt(unitCount) : null,
        }),
      });

      if (!res.ok) throw new Error("Failed to create deal");
      const { deal } = await res.json();

      addDeal(deal);

      // Upload files
      for (const { file } of pendingFiles) {
        const fileType = inferFileType(file.name, file.type);
        const tempDoc = {
          id: `temp-${Date.now()}-${file.name}`,
          deal_id: deal.id,
          name: file.name,
          file_type: fileType as DealDocument["file_type"],
          storage_path: null,
          file_size: file.size,
          raw_text: null,
          status: "pending" as const,
          parse_error: null,
          parsed_at: null,
          created_at: new Date().toISOString(),
          document_type: null,
          parse_confidence: null,
          parse_warnings: null,
          extracted_unit_count: null,
          extracted_field_count: null,
        };
        addDocument(tempDoc);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("dealId", deal.id);

        const docRes = await fetch(`/api/deals/${deal.id}/documents`, {
          method: "POST",
          body: formData,
        });

        if (docRes.ok) {
          const { document } = await docRes.json();
          // Trigger async parse
          fetch(`/api/deals/${deal.id}/parse`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: document.id }),
          });
        }
      }

      onClose();
      router.push(`/opportunities/${deal.id}`);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[16px] w-full max-w-[520px] shadow-[0_24px_60px_rgba(40,35,25,0.22)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e6e3dc]">
          <span className="text-[15px] font-semibold">New deal</span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-[7px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
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
              placeholder="e.g. Calvert Apartments"
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

          {/* File drop */}
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-semibold text-[#3a3833]">
              Upload documents{" "}
              <span className="text-[#9b978f] font-normal">(optional)</span>
            </label>
            <div
              {...getRootProps()}
              className={cn(
                "border-[1.5px] border-dashed rounded-[10px] p-4 text-center cursor-pointer transition-colors",
                isDragActive
                  ? "border-[#2f5d50] bg-[#2f5d5008]"
                  : "border-[#d4cfc3] hover:border-[#2f5d5060]"
              )}
            >
              <input {...getInputProps()} />
              <Upload size={18} className="mx-auto mb-1.5 text-[#b3aea3]" />
              <p className="text-[12.5px] text-[#23211d] font-medium">
                {isDragActive ? "Drop files here…" : "Drop files or click to browse"}
              </p>
              <p className="text-[11px] text-[#9b978f] mt-0.5">
                PDF, CSV, Excel, email, images
              </p>
            </div>
            {pendingFiles.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {pendingFiles.map(({ file, id }) => (
                  <div
                    key={id}
                    className="flex items-center gap-2.5 px-3 py-2 border border-[#e6e3dc] rounded-[8px] bg-[#faf8f3]"
                  >
                    <File size={13} className="text-[#9b978f] flex-shrink-0" />
                    <span className="text-[12px] flex-1 truncate">{file.name}</span>
                    <button
                      onClick={() =>
                        setPendingFiles((prev) =>
                          prev.filter((f) => f.id !== id)
                        )
                      }
                      className="text-[#9b978f] hover:text-[#a8473a] transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
            className="flex items-center gap-2 px-5 py-2 text-[13px] font-semibold bg-[#2f5d50] text-white rounded-[9px] hover:bg-[#274e43] disabled:opacity-40 transition-colors"
          >
            {isCreating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating…
              </>
            ) : (
              "Create deal"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
