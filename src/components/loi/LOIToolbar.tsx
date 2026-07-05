"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { Copy, Download, Send, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LOIState } from "@/types";

interface LOIToolbarProps {
  loiState: LOIState;
  sentAt: string | null;
  onCopy: () => void;
  onDownloadPDF: () => void;
  onSend: () => void;
  onRevise: () => void;
  requiredTermsMissing: boolean;
}

function formatSentDate(sentAt: string): string {
  return new Date(sentAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function LOIToolbar({
  loiState,
  sentAt,
  onCopy,
  onDownloadPDF,
  onSend,
  onRevise,
  requiredTermsMissing,
}: LOIToolbarProps) {
  const isDisabled = loiState === "generating" || loiState === "none";

  return (
    <Tooltip.Provider delayDuration={400}>
      <div className="flex items-center gap-2 px-4 py-[9px] bg-white border-b border-[#e6e3dc] flex-shrink-0">
        {/* Left: utility buttons */}
        <button
          onClick={onCopy}
          disabled={isDisabled}
          className="flex items-center gap-1.5 px-3 py-[5px] text-[12.5px] text-[#6b6862] border border-[#e6e3dc] rounded-[8px] hover:bg-[#f4f2eb] hover:text-[#23211d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Copy size={12} />
          Copy
        </button>

        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              disabled
              aria-label="Download PDF"
              className="flex items-center gap-1.5 px-3 py-[5px] text-[12.5px] text-[#6b6862] border border-[#e6e3dc] rounded-[8px] opacity-40 cursor-not-allowed"
            >
              <Download size={12} />
              Download PDF
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="bg-[#23211d] text-white text-[11.5px] px-2.5 py-1.5 rounded-[6px] shadow-md z-50"
              sideOffset={5}
            >
              Coming soon
              <Tooltip.Arrow className="fill-[#23211d]" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        <div className="flex-1" />

        {/* Right: state-driven actions */}
        {loiState === "draft" && (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              {/* span wrapper ensures tooltip fires even when inner button is disabled */}
              <span className="inline-flex">
                <button
                  onClick={requiredTermsMissing ? undefined : onSend}
                  disabled={requiredTermsMissing}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-[7px] text-[12.5px] font-semibold rounded-[8px] transition-colors",
                    requiredTermsMissing
                      ? "bg-[#2f5d50] text-white opacity-40 cursor-not-allowed pointer-events-none"
                      : "bg-[#2f5d50] text-white hover:bg-[#274e43] cursor-pointer"
                  )}
                >
                  <Send size={12} />
                  Send LOI
                </button>
              </span>
            </Tooltip.Trigger>
            {requiredTermsMissing && (
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-[#23211d] text-white text-[11.5px] px-2.5 py-1.5 rounded-[6px] shadow-md z-50 max-w-[200px]"
                  sideOffset={5}
                >
                  Fill in all required terms (marked ✗) before sending
                  <Tooltip.Arrow className="fill-[#23211d]" />
                </Tooltip.Content>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        )}

        {loiState === "sent" && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-[5px] text-[12px] font-semibold text-[#2f6d4f] bg-[#eaf1ec] rounded-[8px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2f6d4f] flex-shrink-0" />
              LOI Sent{sentAt ? ` · ${formatSentDate(sentAt)}` : ""}
            </span>
            <button
              onClick={onRevise}
              className="flex items-center gap-1.5 px-3 py-[5px] text-[12.5px] text-[#6b6862] border border-[#e6e3dc] rounded-[8px] hover:bg-[#f4f2eb] hover:text-[#23211d] transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
              Revise &amp; resend
            </button>
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
}
