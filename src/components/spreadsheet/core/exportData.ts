import * as XLSX from "xlsx";

export interface ExportColumn {
  header: string;
  /** Plain value for the cell (already unformatted where appropriate) */
  value: (rowIndex: number) => string | number | null;
}

function buildMatrix(
  columns: ExportColumn[],
  rowCount: number
): (string | number | null)[][] {
  const header = columns.map((c) => c.header);
  const rows = Array.from({ length: rowCount }, (_, r) =>
    columns.map((c) => c.value(r))
  );
  return [header, ...rows];
}

function exportFilename(dealName: string, tabName: string, ext: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug(dealName)}-${slug(tabName)}-${date}.${ext}`;
}

export function exportCSV(
  dealName: string,
  tabName: string,
  columns: ExportColumn[],
  rowCount: number
): void {
  const matrix = buildMatrix(columns, rowCount);
  const csv = matrix
    .map((row) =>
      row
        .map((cell) => {
          const s = cell == null ? "" : String(cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFilename(dealName, tabName, "csv");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportXLSX(
  dealName: string,
  tabName: string,
  columns: ExportColumn[],
  rowCount: number
): void {
  const matrix = buildMatrix(columns, rowCount);
  const sheet = XLSX.utils.aoa_to_sheet(matrix);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, tabName.slice(0, 31));
  XLSX.writeFile(book, exportFilename(dealName, tabName, "xlsx"));
}
