import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { DealStatus, DealType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`;
  return `$${dollars.toLocaleString()}`;
}

export function formatDollars(dollars: number | null | undefined): string {
  if (dollars == null) return "—";
  if (Math.abs(dollars) >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(dollars) >= 1_000) {
    return `$${(dollars / 1_000).toFixed(0)}K`;
  }
  return `$${dollars.toLocaleString()}`;
}

export function formatCentsFull(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatPercent(
  value: number | null | undefined,
  decimals = 1
): string {
  if (value == null) return "—";
  return `${value.toFixed(decimals)}%`;
}

export function formatDSCR(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toFixed(2)}x`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function dealStatusLabel(status: DealStatus): string {
  const map: Record<DealStatus, string> = {
    evaluating: "Evaluating",
    off_market: "Off Market",
    marketed: "Marketed",
    under_loi: "Under LOI",
    under_contract: "Under Contract",
    closed: "Closed",
    dead: "Dead",
  };
  return map[status] ?? status;
}

export function dealTypeLabel(type: DealType): string {
  const map: Record<DealType, string> = {
    multifamily: "Multifamily",
    commercial: "Commercial",
    retail: "Retail",
    storage: "Self-Storage",
    industrial: "Industrial",
    land: "Land",
    residential: "Residential",
    mixed_use: "Mixed Use",
    office: "Office",
    hotel: "Hotel",
  };
  return map[type] ?? type;
}

export function fileTypeLabel(type: string): string {
  return type.toUpperCase();
}

export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "txt";
}

export function inferFileType(
  filename: string,
  mimeType?: string
): string {
  const ext = getFileExtension(filename);
  if (["pdf"].includes(ext)) return "pdf";
  if (["csv"].includes(ext)) return "csv";
  if (["xlsx", "xls"].includes(ext)) return "xlsx";
  if (["docx", "doc"].includes(ext)) return "docx";
  if (["txt", "text"].includes(ext)) return "txt";
  if (["eml", "msg"].includes(ext)) return "eml";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
  if (mimeType?.includes("pdf")) return "pdf";
  if (mimeType?.includes("spreadsheet") || mimeType?.includes("excel")) return "xlsx";
  if (mimeType?.includes("csv")) return "csv";
  if (mimeType?.includes("image")) return "image";
  return "txt";
}

export function statusChipClass(status: string): string {
  switch (status) {
    case "off_market":
    case "Off Market":
      return "bg-[#eaf1ec] text-[#2f6d4f]";
    case "under_loi":
    case "Under LOI":
      return "bg-[#e8ecf5] text-[#3a5299]";
    case "marketed":
    case "Marketed":
      return "bg-[#f7efe6] text-[#9a6b3f]";
    case "under_contract":
    case "Under Contract":
      return "bg-[#f1ede8] text-[#7a5a3a]";
    case "closed":
    case "Closed":
      return "bg-[#f1efe8] text-[#6b6862]";
    case "dead":
    case "Dead":
      return "bg-[#f5eaea] text-[#a8473a]";
    default:
      return "bg-[#f1efe8] text-[#8a857a]";
  }
}

export function documentStatusChipClass(status: DocumentStatus): string {
  switch (status) {
    case "parsed":
      return "bg-[#eaf1ec] text-[#2f6d4f]";
    case "parsing":
      return "bg-[#e8ecf5] text-[#3a5299]";
    case "error":
      return "bg-[#f5eaea] text-[#a8473a]";
    default:
      return "bg-[#f1efe8] text-[#8a857a]";
  }
}

type DocumentStatus = "pending" | "parsing" | "parsed" | "error";

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function calcAnnualPayment(
  principal: number,
  annualRate: number,
  termYears: number,
  amortYears: number,
  frequency: "monthly" | "quarterly" | "annual" = "monthly"
): number {
  if (annualRate === 0) {
    return principal / amortYears;
  }
  const periodsPerYear = frequency === "monthly" ? 12 : frequency === "quarterly" ? 4 : 1;
  const ratePerPeriod = annualRate / 100 / periodsPerYear;
  const totalPeriods = amortYears * periodsPerYear;
  const payment =
    (principal * ratePerPeriod * Math.pow(1 + ratePerPeriod, totalPeriods)) /
    (Math.pow(1 + ratePerPeriod, totalPeriods) - 1);
  return payment * periodsPerYear;
}
