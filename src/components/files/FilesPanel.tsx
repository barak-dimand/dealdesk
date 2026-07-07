"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import * as Popover from "@radix-ui/react-popover";
import { useDealStore } from "@/store/dealStore";
import { cn, formatFileSize, inferFileType, timeAgo } from "@/lib/utils";
import {
  FileText,
  Sheet,
  Image as ImageIcon,
  Mail,
  File,
  Clipboard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { ParseReviewModal } from "./ParseReviewModal";
import type { DealDocument } from "@/types";

function fileIcon(type: string) {
  const cls = "w-full h-full object-contain";
  if (type === "pdf") return <FileText className={cls} />;
  if (type === "csv" || type === "xlsx") return <Sheet className={cls} />;
  if (type === "image") return <ImageIcon className={cls} />;
  if (type === "eml") return <Mail className={cls} />;
  if (type === "pasted_text") return <Clipboard className={cls} />;
  return <File className={cls} />;
}

const fileColors: Record<string, string> = {
  pdf: "#a8473a",
  csv: "#2f6d4f",
  xlsx: "#2f6d4f",
  txt: "#6b6862",
  eml: "#9a6b3f",
  image: "#3a2f5d",
  pasted_text: "#6b6862",
  docx: "#3a5299",
};

function ConfidenceChip({ confidence }: { confidence: "high" | "medium" | "low" | null }) {
  if (!confidence) return null;
  const map = {
    high:   { cls: "bg-[#eaf1ec] text-[#2f6d4f]", label: "Parsed" },
    medium: { cls: "bg-[#fdf6ec] text-[#9a6b3f]", label: "~ Parsed" },
    low:    { cls: "bg-[#f7efe6] text-[#9a6b3f]", label: "⚑ Parsed" },
  };
  const { cls, label } = map[confidence];
  return (
    <span className={cn("text-[10.5px] font-semibold px-2 py-[3px] rounded-[6px] whitespace-nowrap", cls)}>
      {label}
    </span>
  );
}

function WarningsBadge({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="text-[10.5px] font-semibold text-[#9a6b3f] bg-[#f7efe6] px-2 py-[3px] rounded-[6px] cursor-pointer hover:bg-[#f0e4d3] transition-colors whitespace-nowrap">
          {warnings.length} {warnings.length === 1 ? "warning" : "warnings"}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="left"
          sideOffset={6}
          className="bg-white border border-[#e6e3dc] rounded-[10px] shadow-[0_8px_24px_rgba(40,35,25,0.14)] p-3.5 max-w-[280px] z-50"
        >
          <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#9a6b3f] mb-2">
            Parse warnings
          </div>
          <div className="flex flex-col gap-1">
            {warnings.map((w, i) => (
              <p key={i} className="text-[12px] text-[#6b6862] leading-[1.5]">
                · {w}
              </p>
            ))}
          </div>
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function FilesPanel() {
  const { activeDeal, documents, addDocument, updateDocumentStatus, setDocuments } =
    useDealStore();
  const [isPasting, setIsPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [reviewDoc, setReviewDoc] = useState<DealDocument | null>(null);

  const handleUpload = useCallback(
    async (files: File[]) => {
      if (!activeDeal) return;

      for (const file of files) {
        const fileType = inferFileType(file.name, file.type);

        const tempDoc: DealDocument = {
          id: `temp-${Date.now()}-${file.name}`,
          deal_id: activeDeal.id,
          name: file.name,
          file_type: fileType as DealDocument["file_type"],
          storage_path: null,
          file_size: file.size,
          raw_text: null,
          status: "pending",
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

        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("dealId", activeDeal.id);

          const res = await fetch(`/api/deals/${activeDeal.id}/documents`, {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            const { document: realDoc } = await res.json();
            // FIX 6: functional update to avoid stale closure
            setDocuments((prev) => [
              { ...realDoc, status: "parsing" as const },
              ...prev.filter((d) => d.id !== tempDoc.id),
            ]);
            // Fire-and-forget parse
            fetch(`/api/deals/${activeDeal.id}/parse`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ documentId: realDoc.id }),
            });
          } else {
            updateDocumentStatus(tempDoc.id, "error");
          }
        } catch {
          updateDocumentStatus(tempDoc.id, "error");
        }
      }
    },
    [activeDeal, addDocument, updateDocumentStatus, setDocuments]
  );

  const handlePasteSubmit = async () => {
    if (!activeDeal || !pasteText.trim()) return;
    setIsPasting(false);

    const tempDoc: DealDocument = {
      id: `temp-paste-${Date.now()}`,
      deal_id: activeDeal.id,
      name: `Pasted text · ${new Date().toLocaleDateString()}`,
      file_type: "pasted_text",
      storage_path: null,
      file_size: pasteText.length,
      raw_text: pasteText,
      status: "pending",
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

    try {
      const res = await fetch(`/api/deals/${activeDeal.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: activeDeal.id,
          pastedText: pasteText,
          name: tempDoc.name,
        }),
      });
      if (res.ok) {
        const { document: realDoc } = await res.json();
        // FIX 6: functional update
        setDocuments((prev) => [
          { ...realDoc, status: "parsing" as const },
          ...prev.filter((d) => d.id !== tempDoc.id),
        ]);
        fetch(`/api/deals/${activeDeal.id}/parse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: realDoc.id }),
        });
      } else {
        updateDocumentStatus(tempDoc.id, "error");
      }
    } catch {
      updateDocumentStatus(tempDoc.id, "error");
    }

    setPasteText("");
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleUpload,
    accept: {
      "application/pdf": [".pdf"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/plain": [".txt"],
      "message/rfc822": [".eml"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    noClick: false,
    disabled: !activeDeal,
  });

  if (!activeDeal) {
    return (
      <div className="flex items-center justify-center h-full text-[#9b978f] text-[13px]">
        Select a deal to manage files.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-[1.5px] border-dashed rounded-[12px] px-6 py-[22px] text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-[#2f5d50] bg-[#2f5d5008]"
            : "border-[#d4cfc3] bg-[#faf8f3] hover:border-[#2f5d5060] hover:bg-[#2f5d500a]"
        )}
      >
        <input {...getInputProps()} />
        <p className="text-[13.5px] font-semibold text-[#23211d] mb-1">
          {isDragActive
            ? "Drop files here…"
            : "Drop PDF, CSV, Excel, Word doc, email, or image"}
        </p>
        <p className="text-[12px] text-[#9b978f]">
          Rent rolls, T12s, P&Ls, seller notes, offer memos — we normalize them all.
        </p>
        {!isDragActive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsPasting(true);
            }}
            className="mt-2 text-[12px] text-[#2f5d50] font-medium hover:underline"
          >
            Or paste text →
          </button>
        )}
      </div>

      {/* Paste text panel — FIX 8 improved UX */}
      {isPasting && (
        <div className="border border-[#e6e3dc] rounded-[10px] p-3 flex flex-col gap-2">
          <p className="text-[12px] font-semibold text-[#3a3833]">
            Paste anything — emails, listing descriptions, Facebook posts, notes, or any deal text
          </p>
          <textarea
            autoFocus
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste text here… AI will extract whatever deal data it can find"
            className="w-full h-32 text-[13px] border border-[#e6e3dc] rounded-[8px] p-3 resize-none outline-none focus:border-[#2f5d50] transition-colors bg-white"
          />
          <div className="flex gap-2">
            <button
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim()}
              className="px-4 py-2 text-[12.5px] font-semibold bg-[#2f5d50] text-white rounded-[8px] hover:bg-[#274e43] disabled:opacity-40 transition-colors"
            >
              Add to deal
            </button>
            <button
              onClick={() => {
                setIsPasting(false);
                setPasteText("");
              }}
              className="px-4 py-2 text-[12.5px] text-[#6b6862] hover:text-[#23211d] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Files list */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-[#3a3833]">
          Files in this deal
        </span>
        <span className="text-[11.5px] text-[#9a6b3f]">
          {documents.filter((d) => d.status === "parsed").length} of{" "}
          {documents.length} parsed
        </span>
      </div>

      <div className="flex flex-col gap-[7px]">
        {documents.length === 0 ? (
          <p className="text-[12px] text-[#b3aea3] text-center py-4">
            No files uploaded yet.
          </p>
        ) : (
          documents.map((doc) => {
            const color = fileColors[doc.file_type] ?? "#6b6862";
            const warnings = doc.parse_warnings ?? [];

            const statusContent =
              doc.status === "parsed" ? (
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <CheckCircle2 size={13} className="text-[#2f6d4f] flex-shrink-0" />
                  <ConfidenceChip confidence={doc.parse_confidence ?? null} />
                  <WarningsBadge warnings={warnings} />
                </div>
              ) : doc.status === "parsing" ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 size={13} className="text-[#3a5299] animate-spin" />
                  <span className="text-[10.5px] font-semibold px-2 py-[3px] rounded-[6px] bg-[#e8ecf5] text-[#3a5299] whitespace-nowrap">
                    Parsing…
                  </span>
                </div>
              ) : doc.status === "error" ? (
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={13} className="text-[#a8473a]" />
                  <span className="text-[10.5px] font-semibold px-2 py-[3px] rounded-[6px] bg-[#f5eaea] text-[#a8473a] whitespace-nowrap">
                    Error
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-[#9b978f]" />
                  <span className="text-[10.5px] font-semibold px-2 py-[3px] rounded-[6px] bg-[#f1efe8] text-[#8a857a] whitespace-nowrap">
                    Pending
                  </span>
                </div>
              );

            return (
              <div
                key={doc.id}
                className={cn(
                  "group flex items-center gap-[11px] px-[11px] py-[10px] border border-[#eae6dd] rounded-[10px] bg-white transition-colors",
                  doc.status === "parsed"
                    ? "hover:bg-[#faf8f3] cursor-pointer"
                    : ""
                )}
                onClick={() => doc.status === "parsed" && setReviewDoc(doc)}
              >
                <div
                  className="w-9 h-9 rounded-[8px] flex-shrink-0 flex items-center justify-center p-2"
                  style={{ background: color }}
                >
                  <div className="w-4 h-4 text-white">{fileIcon(doc.file_type)}</div>
                </div>
                <div className="flex flex-col gap-[2px] min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                      {doc.name}
                    </span>
                    {doc.status === "parsed" && (
                      <span className="text-[11px] text-[#2f5d50] font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 flex-shrink-0">
                        Review <ArrowRight size={10} />
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#9b978f]">
                    {doc.file_type.toUpperCase()}
                    {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ""}
                    {doc.created_at ? ` · ${timeAgo(doc.created_at)}` : ""}
                  </span>
                  {doc.parse_error && (
                    <span className="text-[11px] text-[#a8473a]">{doc.parse_error}</span>
                  )}
                </div>
                <div className="flex-shrink-0">{statusContent}</div>
              </div>
            );
          })
        )}
      </div>

      {/* Parse Review Modal */}
      {reviewDoc && activeDeal && (
        <ParseReviewModal
          document={reviewDoc}
          dealId={activeDeal.id}
          open={!!reviewDoc}
          onClose={() => setReviewDoc(null)}
        />
      )}
    </div>
  );
}
