import { describe, it, expect, vi } from "vitest";
import * as XLSX from "xlsx";
import { extractTextFromFile } from "../extractText";
import { REAL_RENT_ROLL_CSV_CONTENT } from "@/test/fixtures";

vi.mock("mammoth", () => ({
  default: {
    extractRawText: vi.fn().mockResolvedValue({
      value: "Letter of Intent — Calvert Apartments",
      messages: [],
    }),
  },
}));

describe("extractTextFromFile", () => {
  it("PDF extraction returns a string", async () => {
    const result = await extractTextFromFile(Buffer.from("%PDF-1.4 fake"), "pdf", "test.pdf");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("CSV extraction returns pipe-delimited table with headers preserved", async () => {
    const result = await extractTextFromFile(
      Buffer.from(REAL_RENT_ROLL_CSV_CONTENT),
      "csv",
      "rent_roll.csv"
    );
    expect(result).toContain("Unit | Type | Rent | Market Rent | Status | Notes");
    expect(result).toContain("470-1 | 2BR/1BA | 725 | 825 | Occupied");
    expect(result).toContain("CSV Data — 12 rows");
  });

  it("XLSX extraction reads all sheets", async () => {
    const wb = XLSX.utils.book_new();
    const sheet1 = XLSX.utils.aoa_to_sheet([
      ["Unit", "Rent"],
      ["470-1", 725],
    ]);
    const sheet2 = XLSX.utils.aoa_to_sheet([
      ["Expense", "Amount"],
      ["Taxes", 12000],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet1, "RentRoll");
    XLSX.utils.book_append_sheet(wb, sheet2, "Expenses");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const result = await extractTextFromFile(buffer, "xlsx", "workbook.xlsx");
    expect(result).toContain("=== Sheet: RentRoll ===");
    expect(result).toContain("=== Sheet: Expenses ===");
    expect(result).toContain("470-1");
    expect(result).toContain("Taxes");
  });

  it("DOCX extraction uses mammoth and returns clean text", async () => {
    const result = await extractTextFromFile(Buffer.from("PK fake docx"), "docx", "loi.docx");
    expect(result).toBe("Letter of Intent — Calvert Apartments");
    expect(result).not.toContain("PK");
  });

  it("DOC returns the unsupported format message", async () => {
    const result = await extractTextFromFile(Buffer.from("binary doc"), "doc", "old.doc");
    expect(result).toBe(
      "[Legacy .doc format not supported — please save as .docx and re-upload]"
    );
  });

  it("image returns the placeholder string", async () => {
    const result = await extractTextFromFile(Buffer.from("png bytes"), "image", "photo.png");
    expect(result).toBe("[IMAGE: photo.png — will be analyzed visually by AI]");
  });

  it("unknown extension falls back to raw string", async () => {
    const result = await extractTextFromFile(Buffer.from("plain content"), "weird", "file.weird");
    expect(result).toBe("plain content");
  });
});
