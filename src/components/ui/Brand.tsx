"use client";

import { cn } from "@/lib/utils";

interface BrandProps {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

export function Brand({ size = "md", showName = true, className }: BrandProps) {
  const dims = { sm: "w-7 h-7", md: "w-[30px] h-[30px]", lg: "w-10 h-10" };
  const diamond = {
    sm: "w-[9px] h-[9px]",
    md: "w-[11px] h-[11px]",
    lg: "w-[14px] h-[14px]",
  };
  const text = { sm: "text-[13px]", md: "text-[15px]", lg: "text-[18px]" };

  return (
    <div className={cn("flex items-center gap-[9px]", className)}>
      <div
        className={cn(
          "rounded-[8px] bg-[#2f5d50] flex items-center justify-center flex-shrink-0",
          dims[size]
        )}
      >
        <div
          className={cn("bg-white rotate-45 rounded-[2px]", diamond[size])}
        />
      </div>
      {showName && (
        <span
          className={cn(
            "font-bold tracking-[-0.02em] text-[#23211d]",
            text[size]
          )}
        >
          Dealdesk
        </span>
      )}
    </div>
  );
}
