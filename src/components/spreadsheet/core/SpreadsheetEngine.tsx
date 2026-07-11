"use client";

import {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
  Fragment,
} from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  type ColumnDef,
  type Column,
  type Row,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type FilterFn,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  ChevronRight,
  ListFilter,
} from "lucide-react";
import { cn, formatCents } from "@/lib/utils";
import {
  SourceProvenancePopover,
  sourceDotColor,
} from "../SourceProvenancePopover";
import { useSheetUiStore } from "./sheetUiStore";
import { evaluateFormula, isFormula } from "./formulas";
import { exportCSV, exportXLSX, type ExportColumn } from "./exportData";
import { FormulaBar } from "./FormulaBar";
import { FindBar } from "./FindBar";
import { ROW_HEIGHTS, type CellPos, type CellType } from "./types";

// ─── props ───────────────────────────────────────────────────────────────────

export interface SpreadsheetEngineProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  onCellChange?: (rowIndex: number, columnId: string, value: string | number | null) => void;
  onRowAdd?: () => void;
  onRowDelete?: (rowIndex: number) => void;
  frozenColumns?: number;
  showRowNumbers?: boolean;
  totalsRow?: Record<string, string | number>;
  emptyState?: React.ReactNode;
  dealId: string;
  tableId: string;
  dealName?: string;
  /** Optional row grouping (e.g. rent-roll buildings) */
  groupBy?: (row: T) => string;
  groupSubtotal?: (rows: T[]) => string;
  /** Called after the provenance popover marks a cell's row as verified */
  onCellVerified?: (rowIndex: number) => void;
}

type FilterValue =
  | { kind: "text"; q: string }
  | { kind: "range"; min: number | null; max: number | null }
  | { kind: "set"; values: string[] };

type RenderItem<T> =
  | { kind: "group"; key: string; groupRows: Row<T>[] }
  | { kind: "row"; row: Row<T>; leafIdx: number };

const GUTTER_W = 40;

// ─── value helpers ───────────────────────────────────────────────────────────

function metaType<T>(col: Column<T, unknown>): CellType {
  return col.columnDef.meta?.type ?? "text";
}

function parseInput<T>(col: Column<T, unknown>, raw: string): string | number | null {
  const t = metaType(col);
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (t === "currency") {
    const n = Number(trimmed.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }
  if (t === "number" || t === "percent" || t === "delta") {
    const n = Number(trimmed.replace(/[$,%\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return raw;
}

function formatByType(t: CellType, v: unknown): string {
  if (v == null || v === "") return "";
  if (t === "currency" && typeof v === "number") return formatCents(v) ?? "";
  if (t === "percent" && typeof v === "number") return `${v.toFixed(1)}%`;
  return String(v);
}

const smartFilter: FilterFn<unknown> = (row, columnId, filterValue: FilterValue) => {
  const v = row.getValue(columnId);
  if (filterValue.kind === "text") {
    return String(v ?? "").toLowerCase().includes(filterValue.q.toLowerCase());
  }
  if (filterValue.kind === "range") {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return false;
    if (filterValue.min != null && n < filterValue.min) return false;
    if (filterValue.max != null && n > filterValue.max) return false;
    return true;
  }
  return filterValue.values.includes(String(v ?? ""));
};

// ─── engine ──────────────────────────────────────────────────────────────────

export function SpreadsheetEngine<T>({
  columns,
  data,
  onCellChange,
  onRowAdd,
  onRowDelete,
  frozenColumns = 1,
  showRowNumbers = false,
  totalsRow,
  emptyState,
  dealId,
  tableId,
  dealName = "deal",
  groupBy,
  groupSubtotal,
  onCellVerified,
}: SpreadsheetEngineProps<T>) {
  // TanStack Table's return value can't be auto-memoized by the React
  // Compiler — opt this component out
  "use no memo";
  const density = useSheetUiStore((s) => s.density);
  const setEngineApi = useSheetUiStore((s) => s.setEngineApi);
  const rowHeight = ROW_HEIGHTS[density];

  // ── table state ──
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const widthsKey = `dealdesk_col_widths_${tableId}`;
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(widthsKey) ?? "{}");
    } catch {
      return {};
    }
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- component opts out of the compiler via "use no memo"
  const table = useReactTable<T>({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, columnSizing },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    defaultColumn: { filterFn: smartFilter as FilterFn<T>, size: 120, minSize: 60, maxSize: 500 },
    enableMultiSort: true,
    sortDescFirst: false,
  });

  const visibleCols = table.getVisibleLeafColumns();
  const modelRows = table.getRowModel().rows;

  // ── grouping (flattened render items + navigable leaf rows) ──
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const { items, leafRows } = useMemo(() => {
    if (!groupBy) {
      return {
        items: modelRows.map((row, i) => ({ kind: "row", row, leafIdx: i }) as RenderItem<T>),
        leafRows: modelRows,
      };
    }
    const groupsInOrder: { key: string; groupRows: Row<T>[] }[] = [];
    const byKey = new Map<string, Row<T>[]>();
    for (const row of modelRows) {
      const key = groupBy(row.original);
      if (!byKey.has(key)) {
        const bucket: Row<T>[] = [];
        byKey.set(key, bucket);
        groupsInOrder.push({ key, groupRows: bucket });
      }
      byKey.get(key)!.push(row);
    }
    const flat: RenderItem<T>[] = [];
    const leaves: Row<T>[] = [];
    for (const g of groupsInOrder) {
      flat.push({ kind: "group", key: g.key, groupRows: g.groupRows });
      if (!collapsedGroups.has(g.key)) {
        for (const row of g.groupRows) {
          flat.push({ kind: "row", row, leafIdx: leaves.length });
          leaves.push(row);
        }
      }
    }
    return { items: flat, leafRows: leaves };
  }, [modelRows, groupBy, collapsedGroups]);

  /** flattened item index for a leaf row (for scrollToIndex) */
  const itemIndexOfLeaf = useMemo(() => {
    const map = new Map<number, number>();
    items.forEach((it, i) => {
      if (it.kind === "row") map.set(it.leafIdx, i);
    });
    return map;
  }, [items]);

  // ── selection / editing ──
  const [sel, setSel] = useState<CellPos | null>(null);
  const [rangeEnd, setRangeEnd] = useState<CellPos | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [formulas, setFormulas] = useState<Record<string, string>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastRow = leafRows.length - 1;
  const lastCol = visibleCols.length - 1;

  const clampPos = useCallback(
    (p: CellPos): CellPos => ({
      r: Math.max(0, Math.min(lastRow, p.r)),
      c: Math.max(0, Math.min(lastCol, p.c)),
    }),
    [lastRow, lastCol]
  );

  const range = useMemo(() => {
    if (!sel) return null;
    const end = rangeEnd ?? sel;
    return {
      r1: Math.min(sel.r, end.r),
      r2: Math.max(sel.r, end.r),
      c1: Math.min(sel.c, end.c),
      c2: Math.max(sel.c, end.c),
    };
  }, [sel, rangeEnd]);

  function inRange(r: number, c: number): boolean {
    if (!range) return false;
    return r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2;
  }

  // ── cell value plumbing ──
  const fKey = (origIndex: number, colId: string) => `${origIndex}:${colId}`;

  const getCellNumber = useCallback(
    (r: number, c: number): number => {
      const row = leafRows[r];
      const col = visibleCols[c];
      if (!row || !col) return 0;
      const v = row.getValue(col.id);
      const t = metaType(col);
      if (typeof v === "number") return t === "currency" ? v / 100 : v;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    },
    [leafRows, visibleCols]
  );

  const cellRaw = useCallback(
    (row: Row<T>, col: Column<T, unknown>): string => {
      const formula = formulas[fKey(row.index, col.id)];
      if (formula) return formula;
      const v = row.getValue(col.id);
      if (v == null) return "";
      if (metaType(col) === "currency" && typeof v === "number") return String(v / 100);
      return String(v);
    },
    [formulas]
  );

  const cellPlainText = useCallback(
    (row: Row<T>, col: Column<T, unknown>): string => {
      const formula = formulas[fKey(row.index, col.id)];
      if (formula) {
        const leafIdx = leafRows.indexOf(row);
        void leafIdx;
        const computed = evaluateFormula(formula, getCellNumber);
        return computed == null ? formula : String(computed);
      }
      const v = row.getValue(col.id);
      if (v == null) return "";
      if (metaType(col) === "currency" && typeof v === "number") return String(v / 100);
      return String(v);
    },
    [formulas, getCellNumber, leafRows]
  );

  function emitChange(row: Row<T>, col: Column<T, unknown>, value: string | number | null) {
    if (col.columnDef.meta?.editable === false) return;
    onCellChange?.(row.index, col.id, value);
  }

  // ── editing lifecycle ──
  function startEdit(pos: CellPos, initial?: string) {
    const col = visibleCols[pos.c];
    const row = leafRows[pos.r];
    if (!col || !row || col.columnDef.meta?.editable === false) return;
    setSel(pos);
    setRangeEnd(null);
    setDraft(initial ?? cellRaw(row, col));
    setEditing(true);
  }

  // Re-focusing the grid fires the editor's blur synchronously — this guard
  // stops the blur-commit from re-entering while we're already closing
  const closingEditRef = useRef(false);

  function cancelEdit() {
    closingEditRef.current = true;
    setEditing(false);
    setDraft("");
    containerRef.current?.focus();
    closingEditRef.current = false;
  }

  function commitEdit(raw: string, move?: "down" | "right" | "left") {
    if (closingEditRef.current) return;
    closingEditRef.current = true;
    if (!sel) {
      closingEditRef.current = false;
      return;
    }
    const col = visibleCols[sel.c];
    const row = leafRows[sel.r];
    if (col && row) {
      const key = fKey(row.index, col.id);
      if (isFormula(raw)) {
        setFormulas((prev) => ({ ...prev, [key]: raw }));
        const computed = evaluateFormula(raw, getCellNumber);
        if (computed != null) {
          const t = metaType(col);
          emitChange(row, col, t === "currency" ? Math.round(computed * 100) : computed);
        }
      } else {
        setFormulas((prev) => {
          if (!(key in prev)) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
        emitChange(row, col, parseInput(col, raw));
      }
    }
    setEditing(false);
    setDraft("");
    if (move === "down") moveSel(1, 0);
    else if (move === "right") moveSel(0, 1);
    else if (move === "left") moveSel(0, -1);
    containerRef.current?.focus();
    closingEditRef.current = false;
  }

  function moveSel(dr: number, dc: number, extend = false) {
    if (!sel) {
      if (leafRows.length) setSel({ r: 0, c: 0 });
      return;
    }
    if (extend) {
      const base = rangeEnd ?? sel;
      setRangeEnd(clampPos({ r: base.r + dr, c: base.c + dc }));
      return;
    }
    const next = clampPos({ r: sel.r + dr, c: sel.c + dc });
    setRangeEnd(null);
    setSel(next);
    scrollLeafIntoView(next.r);
  }

  function scrollLeafIntoView(leafIdx: number) {
    const itemIdx = itemIndexOfLeaf.get(leafIdx);
    if (itemIdx != null) virtualizer.scrollToIndex(itemIdx);
  }

  // ── copy / paste ──
  const copySelection = useCallback(
    async (cut = false) => {
      if (!range) return;
      const lines: string[] = [];
      for (let r = range.r1; r <= range.r2; r++) {
        const parts: string[] = [];
        for (let c = range.c1; c <= range.c2; c++) {
          parts.push(cellPlainText(leafRows[r], visibleCols[c]));
        }
        lines.push(parts.join("\t"));
      }
      const tsv = lines.join("\n");
      try {
        await navigator.clipboard?.writeText(tsv);
      } catch {
        // clipboard unavailable (permissions)
      }
      if (cut) {
        for (let r = range.r1; r <= range.r2; r++) {
          for (let c = range.c1; c <= range.c2; c++) {
            emitChange(leafRows[r], visibleCols[c], null);
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range, leafRows, visibleCols, cellPlainText]
  );

  const pasteAtSelection = useCallback(async () => {
    if (!sel) return;
    let text = "";
    try {
      text = (await navigator.clipboard?.readText?.()) ?? "";
    } catch {
      return;
    }
    if (!text) return;
    const rows = text.replace(/\r/g, "").split("\n").filter((l, i, a) => !(i === a.length - 1 && l === ""));
    rows.forEach((line, dr) => {
      line.split("\t").forEach((value, dc) => {
        const row = leafRows[sel.r + dr];
        const col = visibleCols[sel.c + dc];
        if (row && col) emitChange(row, col, parseInput(col, value));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, leafRows, visibleCols]);

  // ── find & replace ──
  const [findOpen, setFindOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [query, setQuery] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);

  const matches = useMemo(() => {
    if (!findOpen || !query) return [];
    const q = query.toLowerCase();
    const found: CellPos[] = [];
    leafRows.forEach((row, r) => {
      visibleCols.forEach((col, c) => {
        if (cellPlainText(row, col).toLowerCase().includes(q)) found.push({ r, c });
      });
    });
    return found;
  }, [findOpen, query, leafRows, visibleCols, cellPlainText]);

  const boundedActive = matches.length ? Math.min(activeMatch, matches.length - 1) : 0;

  function gotoMatch(idx: number) {
    if (!matches.length) return;
    const wrapped = ((idx % matches.length) + matches.length) % matches.length;
    setActiveMatch(wrapped);
    const m = matches[wrapped];
    setSel(m);
    setRangeEnd(null);
    scrollLeafIntoView(m.r);
  }

  function replaceMatch(all: boolean) {
    const targets = all ? matches : matches.length ? [matches[boundedActive]] : [];
    for (const m of targets) {
      const row = leafRows[m.r];
      const col = visibleCols[m.c];
      const current = cellPlainText(row, col);
      const replaced = current.replace(new RegExp(escapeRegex(query), "gi"), replaceValue);
      emitChange(row, col, parseInput(col, replaced));
    }
  }

  // ── comments ──
  const commentsKey = `dealdesk_comments_${dealId}_${tableId}`;
  const [comments, setComments] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(commentsKey) ?? "{}");
    } catch {
      return {};
    }
  });
  const [commentEditor, setCommentEditor] = useState<{ x: number; y: number; key: string } | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  function saveComments(next: Record<string, string>) {
    setComments(next);
    try {
      localStorage.setItem(commentsKey, JSON.stringify(next));
    } catch {
      // storage blocked
    }
  }

  // ── context menu ──
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; pos: CellPos } | null>(null);

  // ── provenance popover ──
  const [provPopover, setProvPopover] = useState<{ x: number; y: number; pos: CellPos } | null>(null);

  // ── column resizing ──
  const resizeRef = useRef<{ colId: string; startX: number; startW: number } | null>(null);
  const [resizingCol, setResizingCol] = useState<string | null>(null);

  function persistWidths(sizing: Record<string, number>) {
    try {
      localStorage.setItem(widthsKey, JSON.stringify(sizing));
    } catch {
      // storage blocked
    }
  }

  function onResizeStart(e: React.MouseEvent, col: Column<T, unknown>) {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { colId: col.id, startX: e.clientX, startW: col.getSize() };
    setResizingCol(col.id);
    function onMove(ev: MouseEvent) {
      const drag = resizeRef.current;
      if (!drag) return;
      const w = Math.max(60, Math.min(500, drag.startW + (ev.clientX - drag.startX)));
      setColumnSizing((prev) => ({ ...prev, [drag.colId]: w }));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setResizingCol(null);
      setColumnSizing((prev) => {
        persistWidths(prev);
        return prev;
      });
      resizeRef.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function autoFitColumn(col: Column<T, unknown>) {
    const headerLen = String(col.columnDef.header ?? col.id).length;
    let maxLen = headerLen;
    for (const row of leafRows) {
      maxLen = Math.max(maxLen, cellPlainText(row, col).length);
    }
    const w = Math.max(60, Math.min(500, Math.round(maxLen * 7.5 + 28)));
    setColumnSizing((prev) => {
      const next = { ...prev, [col.id]: w };
      persistWidths(next);
      return next;
    });
  }

  // ── filters UI ──
  const [filterOpenCol, setFilterOpenCol] = useState<string | null>(null);

  // ── conditional formatting: per-column averages ──
  const colAverages = useMemo(() => {
    const map = new Map<string, number>();
    for (const col of visibleCols) {
      const t = metaType(col);
      if (t !== "currency" && t !== "number") continue;
      let sum = 0;
      let count = 0;
      for (const row of leafRows) {
        const v = row.getValue(col.id);
        if (typeof v === "number") {
          sum += v;
          count++;
        }
      }
      if (count > 0) map.set(col.id, sum / count);
    }
    return map;
  }, [visibleCols, leafRows]);

  // ── frozen column offsets ──
  const frozenOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = showRowNumbers ? GUTTER_W : 0;
    for (let i = 0; i < visibleCols.length; i++) {
      offsets.push(acc);
      acc += visibleCols[i].getSize();
    }
    return offsets;
  }, [visibleCols, showRowNumbers, columnSizing]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalWidth =
    (showRowNumbers ? GUTTER_W : 0) +
    visibleCols.reduce((s, c) => s + c.getSize(), 0);

  // ── virtualization ──
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
    // Fallback viewport before first measurement (also keeps jsdom rendering rows)
    initialRect: { width: 800, height: 600 },
  });

  // When the scroll element measures 0 (jsdom, or a hidden tab) the
  // virtualizer yields nothing — fall back to rendering every row
  const virtualItems = virtualizer.getVirtualItems();
  const renderItems: Array<{ index: number; start: number }> =
    virtualItems.length === 0 && items.length > 0
      ? items.map((_, index) => ({ index, start: index * rowHeight }))
      : virtualItems;

  // ── toolbar API registration ──
  const buildExportColumns = useCallback((): ExportColumn[] => {
    return visibleCols.map((col) => ({
      header: String(col.columnDef.header ?? col.id),
      value: (r: number) => {
        const row = table.getCoreRowModel().rows[r];
        if (!row) return null;
        const v = row.getValue(col.id);
        if (v == null) return null;
        if (metaType(col) === "currency" && typeof v === "number") return v / 100;
        return typeof v === "number" ? v : String(v);
      },
    }));
  }, [visibleCols, table]);

  const tabName = tableId;
  const api = useMemo(
    () => ({
      openFind: () => setFindOpen(true),
      exportCsv: () => exportCSV(dealName, tabName, buildExportColumns(), data.length),
      exportXlsx: () => exportXLSX(dealName, tabName, buildExportColumns(), data.length),
      addRow: onRowAdd,
      getColumnToggles: () =>
        table.getAllLeafColumns().map((c) => ({
          id: c.id,
          label: String(c.columnDef.header ?? c.id),
          visible: c.getIsVisible(),
        })),
      toggleColumn: (id: string) => {
        const col = table.getColumn(id);
        col?.toggleVisibility();
      },
    }),
    [dealName, tabName, buildExportColumns, data.length, onRowAdd, table]
  );

  useEffect(() => {
    setEngineApi(api);
    return () => setEngineApi(null);
  }, [api, setEngineApi]);

  // ── keyboard ──
  function onKeyDown(e: React.KeyboardEvent) {
    if (editing) return; // the edit input handles its own keys

    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key.toLowerCase() === "f") {
      e.preventDefault();
      setFindOpen(true);
      setShowReplace(false);
      return;
    }
    if (ctrl && e.key.toLowerCase() === "h") {
      e.preventDefault();
      setFindOpen(true);
      setShowReplace(true);
      return;
    }
    if (ctrl && e.key.toLowerCase() === "c") {
      e.preventDefault();
      copySelection(false);
      return;
    }
    if (ctrl && e.key.toLowerCase() === "x") {
      e.preventDefault();
      copySelection(true);
      return;
    }
    if (ctrl && e.key.toLowerCase() === "v") {
      e.preventDefault();
      pasteAtSelection();
      return;
    }
    if (ctrl && e.key.toLowerCase() === "a") {
      e.preventDefault();
      if (leafRows.length) {
        setSel({ r: 0, c: 0 });
        setRangeEnd({ r: lastRow, c: lastCol });
      }
      return;
    }

    if (!sel) return;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        moveSel(-1, 0, e.shiftKey);
        break;
      case "ArrowDown":
        e.preventDefault();
        moveSel(1, 0, e.shiftKey);
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveSel(0, -1, e.shiftKey);
        break;
      case "ArrowRight":
        e.preventDefault();
        moveSel(0, 1, e.shiftKey);
        break;
      case "Tab":
        e.preventDefault();
        moveSel(0, e.shiftKey ? -1 : 1);
        break;
      case "Enter":
        e.preventDefault();
        startEdit(sel);
        break;
      case "F2":
        e.preventDefault();
        startEdit(sel);
        break;
      case "Home":
        e.preventDefault();
        if (ctrl) {
          setSel({ r: 0, c: 0 });
          scrollLeafIntoView(0);
        } else {
          setSel({ r: sel.r, c: 0 });
        }
        setRangeEnd(null);
        break;
      case "End":
        e.preventDefault();
        if (ctrl) {
          setSel({ r: lastRow, c: lastCol });
          scrollLeafIntoView(lastRow);
        } else {
          setSel({ r: sel.r, c: lastCol });
        }
        setRangeEnd(null);
        break;
      case "PageUp":
        e.preventDefault();
        moveSel(-10, 0, e.shiftKey);
        break;
      case "PageDown":
        e.preventDefault();
        moveSel(10, 0, e.shiftKey);
        break;
      case "Escape":
        setFindOpen(false);
        break;
    }
  }

  // ── cell rendering helpers ──
  function conditionalStyle(row: Row<T>, col: Column<T, unknown>): React.CSSProperties {
    const style: React.CSSProperties = {};
    const t = metaType(col);
    const v = row.getValue(col.id);
    // Verified cells are trusted — no conditional background flagging
    const verified = col.columnDef.meta?.getProvenance?.(row.original)?.user_verified;

    if ((t === "currency" || t === "number" || t === "delta") && typeof v === "number") {
      if (v < 0) style.color = "#a8473a";
      const avg = colAverages.get(col.id);
      if (!verified && avg != null && avg > 0) {
        if (v > avg * 1.2) style.backgroundColor = "rgba(47,109,79,0.07)";
        else if (v < avg * 0.8 && v > 0) style.backgroundColor = "rgba(168,71,58,0.06)";
      }
    }
    if (!verified && col.columnDef.meta?.required && (v == null || v === "")) {
      style.backgroundColor = "rgba(154,107,63,0.10)";
    }
    return style;
  }

  function cellContent(row: Row<T>, col: Column<T, unknown>) {
    const formula = formulas[fKey(row.index, col.id)];
    if (formula) {
      const computed = evaluateFormula(formula, getCellNumber);
      const t = metaType(col);
      if (computed == null) return <span className="text-[#a8473a]">#ERR</span>;
      return formatByType(t, t === "currency" ? Math.round(computed * 100) : computed);
    }
    const cell = row.getAllCells().find((c) => c.column.id === col.id);
    if (cell && col.columnDef.cell) {
      return flexRender(col.columnDef.cell, cell.getContext());
    }
    const v = row.getValue(col.id);
    if (v == null || v === "") return <span className="text-[#c8c3b8]">—</span>;
    return formatByType(metaType(col), v);
  }

  // ── empty state ──
  if (data.length === 0 && emptyState) {
    return <div className="flex-1 flex items-center justify-center p-8">{emptyState}</div>;
  }

  const selectedRow = sel ? leafRows[sel.r] : null;
  const selectedCol = sel ? visibleCols[sel.c] : null;
  const formulaBarValue =
    selectedRow && selectedCol ? cellRaw(selectedRow, selectedCol) : "";

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      {findOpen && (
        <FindBar
          query={query}
          onQueryChange={(q) => {
            setQuery(q);
            setActiveMatch(0);
          }}
          matchCount={matches.length}
          activeMatch={boundedActive}
          onNext={() => gotoMatch(boundedActive + 1)}
          onPrev={() => gotoMatch(boundedActive - 1)}
          onClose={() => setFindOpen(false)}
          showReplace={showReplace}
          replaceValue={replaceValue}
          onReplaceValueChange={setReplaceValue}
          onReplace={() => replaceMatch(false)}
          onReplaceAll={() => replaceMatch(true)}
        />
      )}

      <FormulaBar
        selected={sel}
        value={formulaBarValue}
        editing={editing}
        draft={draft}
        onDraftChange={setDraft}
        onStartEdit={() => sel && startEdit(sel)}
        onCommit={(raw) => commitEdit(raw, "down")}
        onCancel={cancelEdit}
      />

      {/* Grid */}
      <div
        ref={containerRef}
        tabIndex={0}
        role="grid"
        aria-rowcount={leafRows.length}
        onKeyDown={onKeyDown}
        className="flex-1 min-h-0 outline-none flex flex-col"
      >
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto relative">
          <div style={{ width: totalWidth, minWidth: "100%" }}>
            {/* Header */}
            <div
              className="flex sticky top-0 z-30 bg-[#f8f9fa] border-b border-[#e6e3dc]"
              style={{ height: 32 }}
            >
              {showRowNumbers && (
                <div
                  className="flex-shrink-0 sticky left-0 z-40 bg-[#f8f9fa] border-r border-[#e6e3dc]"
                  style={{ width: GUTTER_W }}
                />
              )}
              {visibleCols.map((col, c) => {
                const sorted = col.getIsSorted();
                const frozen = c < frozenColumns;
                const filterActive = col.getFilterValue() != null;
                return (
                  <div
                    key={col.id}
                    onClick={col.getToggleSortingHandler()}
                    className={cn(
                      "group/hdr relative flex items-center gap-1 px-2 text-[11px] font-bold uppercase tracking-[0.05em] text-[#6b6862] border-r border-[#eae6dd] select-none cursor-pointer bg-[#f8f9fa]",
                      frozen && "sticky z-30",
                      resizingCol === col.id && "border-r-2 border-r-[#2f5d50]"
                    )}
                    style={{
                      width: col.getSize(),
                      flexShrink: 0,
                      ...(frozen ? { left: frozenOffsets[c] } : {}),
                      ...(frozen && c === frozenColumns - 1
                        ? { borderRight: "2px solid #e6e3dc", boxShadow: "2px 0 4px rgba(40,35,25,0.05)" }
                        : {}),
                    }}
                  >
                    <span className="truncate">
                      {String(col.columnDef.header ?? col.id)}
                    </span>
                    <span className="text-[10px] flex-shrink-0">
                      {sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : (
                        <span className="opacity-0 group-hover/hdr:opacity-40">⇅</span>
                      )}
                    </span>
                    <div className="flex-1" />
                    {/* Filter icon */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilterOpenCol(filterOpenCol === col.id ? null : col.id);
                      }}
                      aria-label={`Filter ${String(col.columnDef.header ?? col.id)}`}
                      className={cn(
                        "flex-shrink-0 w-4 h-4 items-center justify-center rounded-[3px]",
                        filterActive
                          ? "flex text-[#2f5d50] bg-[#2f5d5018]"
                          : "hidden group-hover/hdr:flex text-[#9b978f] hover:text-[#23211d]"
                      )}
                    >
                      <ListFilter size={11} />
                    </button>
                    {/* Resize handle */}
                    <div
                      onMouseDown={(e) => onResizeStart(e, col)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        autoFitColumn(col);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-0 h-full w-[4px] cursor-col-resize hover:bg-[#2f5d5040]"
                    />
                    {/* Filter dropdown */}
                    {filterOpenCol === col.id && (
                      <FilterDropdown
                        column={col}
                        onClose={() => setFilterOpenCol(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Virtualized body */}
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {renderItems.map((vi) => {
                const item = items[vi.index];
                if (!item) return null;

                if (item.kind === "group") {
                  const isCollapsed = collapsedGroups.has(item.key);
                  return (
                    <div
                      key={`g-${item.key}`}
                      className="absolute left-0 flex items-center gap-1.5 px-2 bg-[#f0ede6] border-b border-[#e6e3dc] font-bold text-[12px] text-[#3a3833] cursor-pointer select-none"
                      style={{ top: vi.start, height: rowHeight, width: "100%" }}
                      onClick={() =>
                        setCollapsedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.key)) next.delete(item.key);
                          else next.add(item.key);
                          return next;
                        })
                      }
                    >
                      {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                      <span className="sticky left-2">{item.key}</span>
                      {groupSubtotal && (
                        <span className="text-[11px] font-medium text-[#6b6862] ml-2">
                          {groupSubtotal(item.groupRows.map((r) => r.original))}
                        </span>
                      )}
                      <span className="text-[11px] font-medium text-[#9b978f] ml-1">
                        · {item.groupRows.length} rows
                      </span>
                    </div>
                  );
                }

                const { row, leafIdx } = item;
                return (
                  <div
                    key={row.id}
                    className="absolute left-0 flex border-b border-[#f4f2eb]"
                    role="row"
                    style={{ top: vi.start, height: rowHeight, width: totalWidth }}
                  >
                    {showRowNumbers && (
                      <div
                        onClick={() => {
                          setSel({ r: leafIdx, c: 0 });
                          setRangeEnd({ r: leafIdx, c: lastCol });
                          containerRef.current?.focus();
                        }}
                        data-testid={`rownum-${leafIdx}`}
                        className="flex-shrink-0 sticky left-0 z-20 flex items-center justify-end pr-1.5 bg-[#f8f9fa] border-r border-[#e6e3dc] text-[10.5px] text-[#9b978f] cursor-pointer select-none hover:bg-[#f0ede6]"
                        style={{ width: GUTTER_W }}
                      >
                        {leafIdx + 1}
                      </div>
                    )}
                    {visibleCols.map((col, c) => {
                      const isSel = sel?.r === leafIdx && sel?.c === c;
                      const isEditing = editing && isSel;
                      const inSelRange = inRange(leafIdx, c);
                      const frozen = c < frozenColumns;
                      const commentKey = fKey(row.index, col.id);
                      const comment = comments[commentKey];
                      const isMatch =
                        findOpen &&
                        query &&
                        matches.some((m) => m.r === leafIdx && m.c === c);
                      const isActiveMatch =
                        isMatch &&
                        matches[boundedActive]?.r === leafIdx &&
                        matches[boundedActive]?.c === c;
                      const align = col.columnDef.meta?.align;

                      return (
                        <div
                          key={col.id}
                          role="gridcell"
                          data-r={leafIdx}
                          data-c={c}
                          aria-selected={isSel || undefined}
                          data-in-range={inSelRange || undefined}
                          title={comment || undefined}
                          onClick={(e) => {
                            if (e.shiftKey && sel) {
                              setRangeEnd({ r: leafIdx, c });
                            } else {
                              setSel({ r: leafIdx, c });
                              setRangeEnd(null);
                            }
                            containerRef.current?.focus();
                          }}
                          onDoubleClick={() => startEdit({ r: leafIdx, c })}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setSel({ r: leafIdx, c });
                            setRangeEnd(null);
                            setCtxMenu({ x: e.clientX, y: e.clientY, pos: { r: leafIdx, c } });
                          }}
                          className={cn(
                            "relative flex items-center px-2 text-[12.5px] text-[#23211d] border-r border-[#f4f2eb] overflow-hidden whitespace-nowrap",
                            frozen && "sticky z-10 bg-white",
                            inSelRange && !isSel && "bg-[#2f5d500f]",
                            isSel && "outline outline-2 -outline-offset-1 outline-[#2f5d50] bg-[#2f5d5008]",
                            isMatch && !isActiveMatch && "bg-[#fff3bf]",
                            isActiveMatch && "bg-[#ffe066]",
                            align === "right" && "justify-end font-mono"
                          )}
                          style={{
                            width: col.getSize(),
                            flexShrink: 0,
                            ...(frozen ? { left: frozenOffsets[c] } : {}),
                            ...(frozen && c === frozenColumns - 1
                              ? { borderRight: "2px solid #e6e3dc", boxShadow: "2px 0 4px rgba(40,35,25,0.05)" }
                              : {}),
                            ...conditionalStyle(row, col),
                          }}
                        >
                          {comment && (
                            <span
                              className="absolute top-0 right-0 w-0 h-0"
                              style={{
                                borderTop: "6px solid #d97706",
                                borderLeft: "6px solid transparent",
                              }}
                            />
                          )}
                          {(() => {
                            const prov = col.columnDef.meta?.getProvenance?.(row.original);
                            if (!prov) return null;
                            if (prov.user_verified) {
                              return (
                                <span
                                  data-testid="verified-mark"
                                  className="absolute top-0 right-[1px] text-[8px] leading-[10px] font-bold text-[#2f6d4f] pointer-events-none"
                                  style={{ zIndex: 1 }}
                                >
                                  ✓
                                </span>
                              );
                            }
                            return (
                              <button
                                data-testid="source-dot"
                                aria-label={`Data source for ${String(col.columnDef.header ?? col.id)}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProvPopover({
                                    x: e.clientX,
                                    y: e.clientY,
                                    pos: { r: leafIdx, c },
                                  });
                                }}
                                onDoubleClick={(e) => e.stopPropagation()}
                                className="absolute top-[2px] right-[2px] w-[6px] h-[6px] rounded-full cursor-pointer"
                                style={{ background: sourceDotColor(prov), zIndex: 1 }}
                              />
                            );
                          })()}
                          {isEditing ? (
                            <input
                              autoFocus
                              aria-label="Cell editor"
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              onBlur={() => commitEdit(draft)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  commitEdit(draft, "down");
                                } else if (e.key === "Tab") {
                                  e.preventDefault();
                                  commitEdit(draft, e.shiftKey ? "left" : "right");
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  cancelEdit();
                                }
                                e.stopPropagation();
                              }}
                              className="absolute inset-0 px-2 text-[12.5px] font-mono outline-none border-2 border-[#2f5d50] bg-white z-20"
                            />
                          ) : (
                            <span className="truncate">{cellContent(row, col)}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Totals row */}
            {totalsRow && (
              <div
                className="flex sticky bottom-0 z-30 bg-[#f6f5f1] border-t-2 border-[#e6e3dc] font-semibold"
                style={{ height: 34 }}
              >
                {showRowNumbers && (
                  <div
                    className="flex-shrink-0 sticky left-0 z-40 bg-[#f6f5f1] border-r border-[#e6e3dc]"
                    style={{ width: GUTTER_W }}
                  />
                )}
                {visibleCols.map((col, c) => {
                  const frozen = c < frozenColumns;
                  const value = totalsRow[col.id];
                  return (
                    <div
                      key={col.id}
                      data-testid={`total-${col.id}`}
                      className={cn(
                        "flex items-center px-2 text-[12px] text-[#23211d] border-r border-[#eae6dd] overflow-hidden whitespace-nowrap bg-[#f6f5f1]",
                        frozen && "sticky z-30",
                        col.columnDef.meta?.align === "right" && "justify-end font-mono"
                      )}
                      style={{
                        width: col.getSize(),
                        flexShrink: 0,
                        ...(frozen ? { left: frozenOffsets[c] } : {}),
                      }}
                    >
                      {c === 0 && value == null ? "Totals" : value ?? ""}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Provenance popover */}
      {provPopover &&
        (() => {
          const pRow = leafRows[provPopover.pos.r];
          const pCol = visibleCols[provPopover.pos.c];
          const prov =
            pRow && pCol ? pCol.columnDef.meta?.getProvenance?.(pRow.original) : null;
          if (!prov) return null;
          const rawVal = pRow.getValue(pCol.id);
          return (
            <SourceProvenancePopover
              open
              onClose={() => setProvPopover(null)}
              anchor={{ x: provPopover.x, y: provPopover.y }}
              fieldLabel={String(pCol.columnDef.header ?? pCol.id)}
              value={formatByType(metaType(pCol), rawVal) || "—"}
              provenance={prov}
              dealId={dealId}
              verifyTarget={pCol.columnDef.meta?.getVerifyTarget?.(pRow.original) ?? null}
              onEdit={() => startEdit(provPopover.pos)}
              onVerified={() => onCellVerified?.(pRow.index)}
            />
          );
        })()}

      {/* Context menu (Radix, anchored at the click position) */}
      {ctxMenu && (
        <DropdownMenu.Root open onOpenChange={(o) => !o && setCtxMenu(null)}>
          <DropdownMenu.Trigger asChild>
            <span
              style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y, width: 0, height: 0 }}
            />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={2}
              className="bg-white border border-[#e6e3dc] rounded-[10px] shadow-[0_8px_24px_rgba(40,35,25,0.14)] py-1 min-w-[180px] z-50"
            >
              {(
                [
                  {
                    label: "Copy cell",
                    action: () => copySelection(false),
                  },
                  {
                    label: "Copy row",
                    action: () => {
                      setSel({ r: ctxMenu.pos.r, c: 0 });
                      setRangeEnd({ r: ctxMenu.pos.r, c: lastCol });
                      // copy happens on the updated range next tick — build directly:
                      const row = leafRows[ctxMenu.pos.r];
                      const tsv = visibleCols.map((col) => cellPlainText(row, col)).join("\t");
                      navigator.clipboard?.writeText(tsv).catch(() => {});
                    },
                  },
                  { label: "Insert row above", action: () => onRowAdd?.(), disabled: !onRowAdd },
                  { label: "Insert row below", action: () => onRowAdd?.(), disabled: !onRowAdd },
                  {
                    label: "Delete row",
                    action: () => {
                      const row = leafRows[ctxMenu.pos.r];
                      if (row) onRowDelete?.(row.index);
                    },
                    disabled: !onRowDelete,
                  },
                  {
                    label: comments[ctxKey(ctxMenu, leafRows, visibleCols)] ? "Edit comment" : "Add comment",
                    action: () => {
                      const key = ctxKey(ctxMenu, leafRows, visibleCols);
                      setCommentDraft(comments[key] ?? "");
                      setCommentEditor({ x: ctxMenu.x, y: ctxMenu.y, key });
                    },
                  },
                  {
                    label: "Clear cell",
                    action: () => {
                      const row = leafRows[ctxMenu.pos.r];
                      const col = visibleCols[ctxMenu.pos.c];
                      if (row && col) emitChange(row, col, null);
                    },
                  },
                ] as Array<{ label: string; action: () => void; disabled?: boolean }>
              ).map((item) => (
                <DropdownMenu.Item
                  key={item.label}
                  disabled={item.disabled}
                  onSelect={() => {
                    item.action();
                    setCtxMenu(null);
                  }}
                  className="px-3 py-1.5 text-[12.5px] text-[#3a3833] outline-none cursor-pointer data-[highlighted]:bg-[#f4f2eb] data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed"
                >
                  {item.label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}

      {/* Comment editor popover */}
      {commentEditor && (
        <Fragment>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setCommentEditor(null)}
          />
          <div
            className="fixed z-50 bg-white border border-[#e6e3dc] rounded-[10px] shadow-[0_8px_24px_rgba(40,35,25,0.16)] p-2.5 w-[240px] flex flex-col gap-2"
            style={{
              left: Math.min(commentEditor.x, typeof window !== "undefined" ? window.innerWidth - 260 : commentEditor.x),
              top: commentEditor.y,
            }}
          >
            <textarea
              autoFocus
              aria-label="Cell comment"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              rows={3}
              placeholder="Add a comment…"
              className="w-full text-[12px] border border-[#e6e3dc] rounded-[7px] p-2 outline-none focus:border-[#2f5d50] resize-none"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  const next = { ...comments };
                  delete next[commentEditor.key];
                  saveComments(next);
                  setCommentEditor(null);
                }}
                className="text-[11.5px] text-[#a8473a] hover:underline cursor-pointer"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  if (commentDraft.trim()) {
                    saveComments({ ...comments, [commentEditor.key]: commentDraft.trim() });
                  }
                  setCommentEditor(null);
                }}
                className="px-3 py-1 text-[11.5px] font-semibold bg-[#2f5d50] text-white rounded-[7px] hover:bg-[#274e43] cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </Fragment>
      )}
    </div>
  );
}

function ctxKey<T>(
  ctx: { pos: CellPos },
  leafRows: Row<T>[],
  visibleCols: Column<T, unknown>[]
): string {
  const row = leafRows[ctx.pos.r];
  const col = visibleCols[ctx.pos.c];
  return `${row?.index ?? 0}:${col?.id ?? ""}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── per-column filter dropdown ──────────────────────────────────────────────

function FilterDropdown<T>({
  column,
  onClose,
}: {
  column: Column<T, unknown>;
  onClose: () => void;
}) {
  const t = column.columnDef.meta?.type ?? "text";
  const current = column.getFilterValue() as FilterValue | undefined;
  const uniqueValues =
    t === "status"
      ? Array.from(column.getFacetedUniqueValues().keys()).map((v) => String(v ?? ""))
      : [];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-full left-0 z-50 mt-1 bg-white border border-[#e6e3dc] rounded-[10px] shadow-[0_8px_24px_rgba(40,35,25,0.14)] p-2.5 w-[200px] flex flex-col gap-2 normal-case font-normal tracking-normal cursor-default"
      >
        {t === "status" ? (
          <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto">
            {uniqueValues.map((v) => {
              const selected =
                current?.kind === "set" ? current.values.includes(v) : false;
              return (
                <label key={v} className="flex items-center gap-2 text-[12px] text-[#3a3833] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => {
                      const values =
                        current?.kind === "set" ? [...current.values] : [];
                      const idx = values.indexOf(v);
                      if (idx >= 0) values.splice(idx, 1);
                      else values.push(v);
                      column.setFilterValue(
                        values.length ? { kind: "set", values } : undefined
                      );
                    }}
                    className="accent-[#2f5d50]"
                  />
                  {v || "(empty)"}
                </label>
              );
            })}
          </div>
        ) : t === "currency" || t === "number" || t === "delta" ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Min"
              aria-label="Filter minimum"
              defaultValue={current?.kind === "range" ? current.min ?? "" : ""}
              onChange={(e) => {
                const min = e.target.value === "" ? null : Number(e.target.value);
                const max = current?.kind === "range" ? current.max : null;
                column.setFilterValue(
                  min == null && max == null ? undefined : { kind: "range", min, max }
                );
              }}
              className="w-full text-[12px] border border-[#e6e3dc] rounded-[6px] px-2 py-1 outline-none focus:border-[#2f5d50]"
            />
            <span className="text-[11px] text-[#9b978f]">–</span>
            <input
              type="number"
              placeholder="Max"
              aria-label="Filter maximum"
              defaultValue={current?.kind === "range" ? current.max ?? "" : ""}
              onChange={(e) => {
                const max = e.target.value === "" ? null : Number(e.target.value);
                const min = current?.kind === "range" ? current.min : null;
                column.setFilterValue(
                  min == null && max == null ? undefined : { kind: "range", min, max }
                );
              }}
              className="w-full text-[12px] border border-[#e6e3dc] rounded-[6px] px-2 py-1 outline-none focus:border-[#2f5d50]"
            />
          </div>
        ) : (
          <input
            autoFocus
            type="text"
            placeholder="Filter…"
            aria-label="Filter text"
            defaultValue={current?.kind === "text" ? current.q : ""}
            onChange={(e) => {
              column.setFilterValue(
                e.target.value ? { kind: "text", q: e.target.value } : undefined
              );
            }}
            className="w-full text-[12px] border border-[#e6e3dc] rounded-[6px] px-2 py-1.5 outline-none focus:border-[#2f5d50]"
          />
        )}
        <button
          onClick={() => {
            column.setFilterValue(undefined);
            onClose();
          }}
          className="text-[11.5px] text-[#6b6862] hover:text-[#23211d] text-left cursor-pointer"
        >
          Clear filter
        </button>
      </div>
    </>
  );
}
