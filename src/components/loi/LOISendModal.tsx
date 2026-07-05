"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LOISendModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (to: string) => void;
  dealId: string;
  dealName: string;
  prefillEmail: string | null;
  prefillName: string | null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function LOISendModal({
  open,
  onClose,
  onSuccess,
  dealId,
  dealName,
  prefillEmail,
  prefillName,
}: LOISendModalProps) {
  const [to, setTo] = useState(prefillEmail ?? "");
  const [toError, setToError] = useState("");
  const [subject, setSubject] = useState(`Letter of Intent — ${dealName}`);
  const [coverNote, setCoverNote] = useState(
    `Hi ${prefillName ?? "there"},\n\nPlease find attached our Letter of Intent for ${dealName}. We're excited about the opportunity and would welcome a conversation at your convenience.\n\nBest regards,\n[Buyer Name]`
  );
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  function handleToBlur() {
    if (to && !isValidEmail(to)) {
      setToError("Please enter a valid email address.");
    } else {
      setToError("");
    }
  }

  async function handleSend() {
    if (!isValidEmail(to)) {
      setToError("Please enter a valid email address.");
      return;
    }
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(`/api/deals/${dealId}/loi`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loi_state: "sent", contact_email: to.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to send LOI");
      }
      onSuccess(to.trim());
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const canSend = to.trim().length > 0 && isValidEmail(to) && !sending;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o && !sending) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[520px] bg-white rounded-[16px] shadow-[0_24px_60px_rgba(40,35,25,0.22)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#e6e3dc]">
            <Dialog.Title className="text-[15px] font-semibold text-[#23211d]">
              Send LOI
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                disabled={sending}
                className="w-7 h-7 flex items-center justify-center rounded-[7px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="px-6 py-5 flex flex-col gap-4 max-h-[72vh] overflow-y-auto">
            {/* To */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">
                To <span className="text-[#a8473a]">*</span>
              </label>
              <input
                type="email"
                autoFocus
                value={to}
                onChange={(e) => { setTo(e.target.value); setToError(""); }}
                onBlur={handleToBlur}
                placeholder="seller@example.com"
                disabled={sending}
                className={cn(
                  "border rounded-[9px] px-3 py-2.5 text-[13px] outline-none transition-colors disabled:opacity-60",
                  toError
                    ? "border-[#a8473a] focus:border-[#a8473a]"
                    : "border-[#e6e3dc] focus:border-[#2f5d50]"
                )}
              />
              {toError && (
                <span className="text-[11.5px] text-[#a8473a]">{toError}</span>
              )}
            </div>

            {/* Subject */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending}
                className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors disabled:opacity-60"
              />
            </div>

            {/* Cover note */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#3a3833]">Cover note</label>
              <textarea
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
                rows={5}
                disabled={sending}
                className="border border-[#e6e3dc] rounded-[9px] px-3 py-2.5 text-[13px] outline-none focus:border-[#2f5d50] transition-colors resize-none disabled:opacity-60"
              />
            </div>

            {/* Attachment preview */}
            <div className="flex items-center gap-2.5 border border-[#e6e3dc] rounded-[10px] px-3 py-2.5 bg-[#faf8f3]">
              <div className="w-8 h-8 rounded-[7px] bg-[#a8473a] flex items-center justify-center flex-shrink-0">
                <FileText size={14} className="text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12.5px] font-medium text-[#23211d] truncate">
                  LOI — {dealName}.pdf
                </span>
                <span className="text-[11px] text-[#9b978f]">PDF · Attached</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 px-6 py-4 border-t border-[#e6e3dc]">
            {sendError && (
              <p className="text-[11.5px] text-[#a8473a] text-right">{sendError}</p>
            )}
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={onClose}
                disabled={sending}
                className="px-4 py-2 text-[13px] text-[#6b6862] hover:text-[#23211d] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="flex items-center gap-2 px-5 py-2 text-[13px] font-semibold bg-[#2f5d50] text-white rounded-[9px] hover:bg-[#274e43] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {sending && <Loader2 size={13} className="animate-spin" />}
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
