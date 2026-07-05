import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseDocumentWithAI } from "../parseDocument";
import {
  AGGREGATE_ONLY_CSV_CONTENT,
  REAL_RENT_ROLL_CSV_CONTENT,
  CALVERT_UNITS,
} from "@/test/fixtures";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

function aiTextResponse(payload: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

const AGGREGATE_WARNING =
  "No unit-level detail found — only aggregate data available. Upload a detailed rent roll for individual unit data.";

// What the AI is expected to return per the CRITICAL unit extraction rule
const AGGREGATE_ONLY_AI_RESPONSE = {
  documentType: "seller_notes",
  confidence: 0.8,
  warnings: [AGGREGATE_WARNING],
  notes: "Aggregate summary only — no unit-level rows.",
  units: [],
  incomeItems: [
    {
      field_key: "annual_gross_income",
      field_label: "Annual Gross Income",
      value_numeric: 136404,
      period: "annual",
      ai_note: null,
      confidence: 0.9,
    },
  ],
  expenseItems: [],
  summaryItems: [
    {
      field_key: "avg_1br_rent",
      field_label: "Avg 1BR Rent",
      value_numeric: 629,
      period: "monthly",
      ai_note: "From unit mix aggregate",
      confidence: 0.9,
    },
    {
      field_key: "avg_2br_rent",
      field_label: "Avg 2BR Rent",
      value_numeric: 678,
      period: "monthly",
      ai_note: "From unit mix aggregate",
      confidence: 0.9,
    },
    {
      field_key: "asking_price",
      field_label: "Asking Price",
      value_numeric: 1125000,
      period: "annual",
      ai_note: null,
      confidence: 0.95,
    },
  ],
};

// 12 units matching REAL_RENT_ROLL_CSV_CONTENT (rents in dollars/month per contract)
const RENT_ROLL_AI_RESPONSE = {
  documentType: "rent_roll",
  confidence: 0.92,
  warnings: [],
  notes: "Full unit-level rent roll.",
  units: [
    { unit_number: "470-1", unit_type: "2BR/1BA", current_rent: 725, market_rent: 825, status: "occupied", lease_start: null, lease_end: null, tenant_notes: null },
    { unit_number: "470-2", unit_type: "2BR/1BA", current_rent: 725, market_rent: 825, status: "occupied", lease_start: null, lease_end: null, tenant_notes: null },
    { unit_number: "470-3", unit_type: "2BR/1BA", current_rent: 775, market_rent: 825, status: "occupied", lease_start: null, lease_end: null, tenant_notes: null },
    { unit_number: "470-4", unit_type: "2BR/1BA", current_rent: 625, market_rent: 825, status: "occupied", lease_start: null, lease_end: null, tenant_notes: null },
    { unit_number: "470-5", unit_type: "2BR/1BA", current_rent: 600, market_rent: 825, status: "occupied", lease_start: null, lease_end: null, tenant_notes: null },
    { unit_number: "470-6", unit_type: "2BR/1BA", current_rent: null, market_rent: 825, status: "vacant", lease_start: null, lease_end: null, tenant_notes: "Make-ready" },
    { unit_number: "490-1", unit_type: "1BR/1BA", current_rent: 600, market_rent: 700, status: "occupied", lease_start: null, lease_end: null, tenant_notes: null },
    { unit_number: "490-2", unit_type: "1BR/1BA", current_rent: 680, market_rent: 700, status: "occupied", lease_start: null, lease_end: null, tenant_notes: null },
    { unit_number: "490-3", unit_type: "1BR/1BA", current_rent: 600, market_rent: 700, status: "occupied", lease_start: null, lease_end: null, tenant_notes: null },
    { unit_number: "490-4", unit_type: "1BR/1BA", current_rent: 178, market_rent: 700, status: "credit", lease_start: null, lease_end: null, tenant_notes: "Lawncare credit" },
    { unit_number: "490-5", unit_type: "1BR/1BA", current_rent: 625, market_rent: 700, status: "occupied", lease_start: null, lease_end: null, tenant_notes: null },
    { unit_number: "490-6", unit_type: "1BR/1BA", current_rent: null, market_rent: 700, status: "leased", lease_start: null, lease_end: null, tenant_notes: "$725 signed" },
  ],
  incomeItems: [],
  expenseItems: [],
  summaryItems: [],
};

describe("parseDocumentWithAI", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("aggregate-only CSV → empty units array + missing-unit-detail warning", async () => {
    createMock.mockResolvedValue(aiTextResponse(AGGREGATE_ONLY_AI_RESPONSE));

    const result = await parseDocumentWithAI(
      AGGREGATE_ONLY_CSV_CONTENT,
      "summary.csv",
      "csv"
    );

    expect(result.units).toEqual([]);
    expect(result.warnings).toContain(AGGREGATE_WARNING);
    expect(result.summaryItems.map((s) => s.field_key)).toContain("avg_1br_rent");

    // The CRITICAL no-estimation rule must be in the system prompt sent to Claude
    const callArgs = createMock.mock.calls[0][0];
    expect(callArgs.system).toContain("Do NOT estimate, reconstruct, or generate unit data");
  });

  it("real rent roll CSV → 12 units with rents matching cents fixture", async () => {
    createMock.mockResolvedValue(aiTextResponse(RENT_ROLL_AI_RESPONSE));

    const result = await parseDocumentWithAI(
      REAL_RENT_ROLL_CSV_CONTENT,
      "rent_roll.csv",
      "csv"
    );

    expect(result.units).toHaveLength(12);

    // parseDocumentWithAI returns dollars/month; the parse route multiplies ×100.
    // Verify dollars×100 equals the canonical cents fixture values.
    for (const unit of result.units) {
      const fixture = CALVERT_UNITS.find((u) => u.unit_number === unit.unit_number);
      expect(fixture).toBeDefined();
      if (unit.current_rent != null) {
        expect(Math.round(unit.current_rent * 100)).toBe(fixture!.current_rent);
      }
    }
    expect(result.units[0].current_rent).toBe(725);
  });

  it("malformed AI JSON → resolves gracefully without throwing", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "Sorry, I cannot produce JSON right now." }],
    });

    const result = await parseDocumentWithAI("some text", "bad.csv", "csv");

    expect(result.units).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(result.warnings).toContain("AI parsing failed");
    expect(result.documentType).toBe("other");
  });

  it("documentType, confidence, and warnings are present in the return value", async () => {
    createMock.mockResolvedValue(aiTextResponse(RENT_ROLL_AI_RESPONSE));

    const result = await parseDocumentWithAI(
      REAL_RENT_ROLL_CSV_CONTENT,
      "rent_roll.csv",
      "csv"
    );

    expect(result.documentType).toBe("rent_roll");
    expect(result.confidence).toBe(0.92);
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});
