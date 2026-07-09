import type { RowData } from "@tanstack/react-table";

export type CellType = "text" | "number" | "currency" | "date" | "status" | "delta" | "percent";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Drives editing parse/format, filters, and conditional formatting */
    type?: CellType;
    align?: "left" | "right";
    /** false = computed column, cannot be edited (default true) */
    editable?: boolean;
    /** Empty cells in required columns get an amber hint background */
    required?: boolean;
  }
}

export interface CellPos {
  /** Visual row index (into the sorted/filtered row model) */
  r: number;
  /** Visual column index (into visible leaf columns) */
  c: number;
}

export type Density = "comfortable" | "compact" | "tall";

export const ROW_HEIGHTS: Record<Density, number> = {
  comfortable: 38,
  compact: 28,
  tall: 52,
};

/** Column letter for A1-style refs: 0 → A, 25 → Z, 26 → AA */
export function columnLetter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

export function letterToColumn(letter: string): number {
  let n = 0;
  for (const ch of letter.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}
