import mammoth from "mammoth";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export async function extractTextFromFile(
  buffer: Buffer,
  fileType: string,
  fileName: string
): Promise<string> {
  switch (fileType) {
    case "pdf":
      return extractPDF(buffer);
    case "csv":
      return extractCSV(buffer.toString("utf-8"));
    case "xlsx":
      return extractXLSX(buffer);
    case "docx":
      return extractDOCX(buffer);
    case "doc":
      return "[Legacy .doc format not supported — please save as .docx and re-upload]";
    case "txt":
    case "pasted_text":
    case "eml":
      return buffer.toString("utf-8");
    case "image":
      return `[IMAGE: ${fileName} — will be analyzed visually by AI]`;
    default:
      return buffer.toString("utf-8");
  }
}

async function extractPDF(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const result = await pdfParse(buffer);
    return result.text;
  } catch (e) {
    console.error("PDF parse error:", e);
    return "[Could not extract text from PDF]";
  }
}

async function extractDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "[DOCX file contained no extractable text]";
  } catch (e) {
    console.error("DOCX parse error:", e);
    return "[DOCX extraction failed — file may be corrupted or password-protected]";
  }
}

function extractCSV(text: string): string {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.data.length === 0) return text;

  const headers = result.meta.fields ?? [];
  const rows = result.data as Record<string, string>[];

  let out = `CSV Data — ${rows.length} rows\n`;
  out += headers.join(" | ") + "\n";
  out += "-".repeat(80) + "\n";
  rows.slice(0, 200).forEach((row) => {
    out += headers.map((h) => (row[h] ?? "")).join(" | ") + "\n";
  });
  if (rows.length > 200) {
    out += `... and ${rows.length - 200} more rows\n`;
  }
  return out;
}

function extractXLSX(buffer: Buffer): string {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    let out = "";

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      if (csv.trim()) {
        out += `\n=== Sheet: ${sheetName} ===\n`;
        out += extractCSV(csv);
      }
    });

    return out || "[Empty spreadsheet]";
  } catch (e) {
    console.error("XLSX parse error:", e);
    return "[Could not parse spreadsheet]";
  }
}
