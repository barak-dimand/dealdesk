import { cn } from "@/lib/utils";

interface ChipProps {
  label: string;
  tone?: "default" | "positive" | "negative" | "amber" | "blue" | "accent";
  className?: string;
}

export function Chip({ label, tone = "default", className }: ChipProps) {
  const toneClass = {
    default: "bg-[#f1efe8] text-[#8a857a]",
    positive: "bg-[#eaf1ec] text-[#2f6d4f]",
    negative: "bg-[#f5eaea] text-[#a8473a]",
    amber: "bg-[#f7efe6] text-[#9a6b3f]",
    blue: "bg-[#e8ecf5] text-[#3a5299]",
    accent: "bg-[#2f5d5014] text-[#2f5d50]",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] font-semibold px-[7px] py-[2px] rounded-[5px] whitespace-nowrap",
        toneClass,
        className
      )}
    >
      {label}
    </span>
  );
}
