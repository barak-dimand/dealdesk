import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { SpreadsheetEngine } from "../SpreadsheetEngine";

interface Item {
  name: string;
  qty: number;
  price: number;
  status: string;
}

const DATA: Item[] = [
  { name: "Alpha", qty: 4, price: 72500, status: "occupied" },
  { name: "Bravo", qty: 2, price: 60000, status: "vacant" },
  { name: "Charlie", qty: 7, price: 82500, status: "occupied" },
  { name: "Delta", qty: 1, price: 17800, status: "credit" },
];

const COLUMNS: ColumnDef<Item, unknown>[] = [
  { id: "name", header: "Name", accessorKey: "name", size: 120, meta: { type: "text" } },
  { id: "qty", header: "Qty", accessorKey: "qty", size: 80, meta: { type: "number", align: "right" } },
  { id: "price", header: "Price", accessorKey: "price", size: 110, meta: { type: "currency", align: "right" } },
  { id: "status", header: "Status", accessorKey: "status", size: 100, meta: { type: "status" } },
];

function cell(r: number, c: number): HTMLElement {
  const el = document.querySelector(`[data-r="${r}"][data-c="${c}"]`);
  if (!el) throw new Error(`cell ${r},${c} not found`);
  return el as HTMLElement;
}

function grid(): HTMLElement {
  return screen.getByRole("grid");
}

function renderEngine(
  overrides: Partial<React.ComponentProps<typeof SpreadsheetEngine<Item>>> = {}
) {
  const onCellChange = vi.fn();
  const utils = render(
    <SpreadsheetEngine<Item>
      columns={COLUMNS}
      data={DATA}
      onCellChange={onCellChange}
      dealId="test-deal"
      tableId="test-table"
      showRowNumbers
      frozenColumns={1}
      {...overrides}
    />
  );
  return { ...utils, onCellChange };
}

describe("SpreadsheetEngine", () => {
  beforeEach(() => {
    localStorage.clear();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const readText = vi.fn().mockResolvedValue("");
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText, readText },
      configurable: true,
    });
  });

  it("renders rows and column headers correctly", () => {
    renderEngine();
    for (const header of ["Name", "Qty", "Price", "Status"]) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }
    for (const row of DATA) {
      expect(screen.getByText(row.name)).toBeInTheDocument();
    }
  });

  it("clicking a cell selects it", () => {
    renderEngine();
    fireEvent.click(cell(0, 0));
    expect(cell(0, 0)).toHaveAttribute("aria-selected", "true");
    expect(cell(1, 0)).not.toHaveAttribute("aria-selected");
  });

  it("double-clicking a cell enters edit mode", () => {
    renderEngine();
    fireEvent.doubleClick(cell(0, 0));
    const editor = screen.getByLabelText("Cell editor") as HTMLInputElement;
    expect(editor).toBeInTheDocument();
    expect(editor.value).toBe("Alpha");
  });

  it("Escape cancels edit and restores value", () => {
    const { onCellChange } = renderEngine();
    fireEvent.doubleClick(cell(0, 0));
    const editor = screen.getByLabelText("Cell editor");
    fireEvent.change(editor, { target: { value: "Changed" } });
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(screen.queryByLabelText("Cell editor")).not.toBeInTheDocument();
    expect(onCellChange).not.toHaveBeenCalled();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("Enter confirms edit and moves selection down", () => {
    const { onCellChange } = renderEngine();
    fireEvent.doubleClick(cell(0, 0));
    const editor = screen.getByLabelText("Cell editor");
    fireEvent.change(editor, { target: { value: "Neo" } });
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(onCellChange).toHaveBeenCalledWith(0, "name", "Neo");
    expect(cell(1, 0)).toHaveAttribute("aria-selected", "true");
  });

  it("Tab moves selection right, Shift+Tab moves left", () => {
    renderEngine();
    fireEvent.click(cell(0, 0));
    fireEvent.keyDown(grid(), { key: "Tab" });
    expect(cell(0, 1)).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(grid(), { key: "Tab", shiftKey: true });
    expect(cell(0, 0)).toHaveAttribute("aria-selected", "true");
  });

  it("arrow keys navigate between cells", () => {
    renderEngine();
    fireEvent.click(cell(0, 0));
    fireEvent.keyDown(grid(), { key: "ArrowDown" });
    expect(cell(1, 0)).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(grid(), { key: "ArrowRight" });
    expect(cell(1, 1)).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(grid(), { key: "ArrowUp" });
    expect(cell(0, 1)).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(grid(), { key: "ArrowLeft" });
    expect(cell(0, 0)).toHaveAttribute("aria-selected", "true");
  });

  it("Ctrl+A selects all cells", () => {
    renderEngine();
    fireEvent.click(cell(0, 0));
    fireEvent.keyDown(grid(), { key: "a", ctrlKey: true });
    expect(cell(3, 3)).toHaveAttribute("data-in-range", "true");
    expect(cell(2, 1)).toHaveAttribute("data-in-range", "true");
  });

  it("onCellChange receives correct rowIndex, columnId, and parsed value", () => {
    const { onCellChange } = renderEngine();
    // currency column parses dollars → cents
    fireEvent.doubleClick(cell(1, 2));
    const editor = screen.getByLabelText("Cell editor");
    fireEvent.change(editor, { target: { value: "$750" } });
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(onCellChange).toHaveBeenCalledWith(1, "price", 75000);
  });

  it("totals row renders with correct values", () => {
    renderEngine({
      totalsRow: { name: "Totals", qty: 14, price: "$2,328" },
    });
    expect(screen.getByTestId("total-name")).toHaveTextContent("Totals");
    expect(screen.getByTestId("total-qty")).toHaveTextContent("14");
    expect(screen.getByTestId("total-price")).toHaveTextContent("$2,328");
  });

  it("frozen column has sticky positioning", () => {
    renderEngine();
    // first data column (index 0) is frozen
    expect(cell(0, 0).className).toContain("sticky");
    expect(cell(0, 1).className).not.toContain("sticky");
  });

  it("column sort toggles asc → desc → none on header click", () => {
    renderEngine();
    const qtyHeader = screen.getByText("Qty").closest("div")!;
    fireEvent.click(qtyHeader);
    expect(cell(0, 0)).toHaveTextContent("Delta"); // qty 1 first (asc)
    fireEvent.click(qtyHeader);
    expect(cell(0, 0)).toHaveTextContent("Charlie"); // qty 7 first (desc)
    fireEvent.click(qtyHeader);
    expect(cell(0, 0)).toHaveTextContent("Alpha"); // original order
  });

  it("Ctrl+C writes TSV to the clipboard", () => {
    renderEngine();
    fireEvent.click(cell(0, 0));
    fireEvent.click(cell(1, 1), { shiftKey: true });
    fireEvent.keyDown(grid(), { key: "c", ctrlKey: true });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Alpha\t4\nBravo\t2");
  });

  it("row number click selects the entire row", () => {
    renderEngine();
    fireEvent.click(screen.getByTestId("rownum-1"));
    expect(cell(1, 0)).toHaveAttribute("data-in-range", "true");
    expect(cell(1, 3)).toHaveAttribute("data-in-range", "true");
    expect(cell(0, 0)).not.toHaveAttribute("data-in-range");
  });

  it("context menu appears on right-click with correct options", () => {
    renderEngine({ onRowAdd: vi.fn(), onRowDelete: vi.fn() });
    fireEvent.contextMenu(cell(0, 0));
    for (const label of [
      "Copy cell",
      "Copy row",
      "Insert row above",
      "Insert row below",
      "Delete row",
      "Add comment",
      "Clear cell",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
