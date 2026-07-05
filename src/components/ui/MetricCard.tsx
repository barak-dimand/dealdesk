import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  subtext?: string;
  tone?: "default" | "positive" | "negative" | "amber" | "accent";
  size?: "sm" | "md" | "lg";
  className?: string;
  highlight?: boolean;
}

export function MetricCard({
  label,
  value,
  subtext,
  tone = "default",
  size = "md",
  className,
  highlight = false,
}: MetricCardProps) {
  const toneStyles = {
    default: {
      border: "border-[#e6e3dc]",
      bg: "bg-white",
      value: "text-[#23211d]",
      label: "text-[#9b978f]",
    },
    positive: {
      border: "border-[#d4e3d9]",
      bg: "bg-[#eaf1ec]",
      value: "text-[#2f6d4f]",
      label: "text-[#2f6d4f]/70",
    },
    negative: {
      border: "border-[#ecd4d4]",
      bg: "bg-[#f7ecec]",
      value: "text-[#a8473a]",
      label: "text-[#a8473a]/70",
    },
    amber: {
      border: "border-[#ecdcc7]",
      bg: "bg-[#f7efe6]",
      value: "text-[#9a6b3f]",
      label: "text-[#9a6b3f]/70",
    },
    accent: {
      border: "border-[#2f5d5033]",
      bg: "bg-[#2f5d5014]",
      value: "text-[#2f5d50]",
      label: "text-[#2f5d50]/70",
    },
  }[tone];

  const sizeStyles = {
    sm: { padding: "p-3", value: "text-[18px]", label: "text-[10px]" },
    md: { padding: "p-4", value: "text-[22px]", label: "text-[11px]" },
    lg: { padding: "p-5", value: "text-[28px]", label: "text-[12px]" },
  }[size];

  return (
    <div
      className={cn(
        "rounded-[10px] border",
        toneStyles.border,
        toneStyles.bg,
        sizeStyles.padding,
        highlight && "ring-2 ring-[#2f5d50]/20",
        className
      )}
    >
      <div
        className={cn(
          "text-[10px] font-bold uppercase tracking-[0.05em] mb-1",
          toneStyles.label
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "font-semibold font-mono tracking-[-0.02em]",
          sizeStyles.value,
          toneStyles.value
        )}
      >
        {value}
      </div>
      {subtext && (
        <div className="text-[11px] mt-1 text-[#9b978f]">{subtext}</div>
      )}
    </div>
  );
}
