import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateLOI } from "../generateLOI";
import { SECTION_META, LOI_SECTION_TEMPLATES } from "@/lib/loi/loiTemplate";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

const CTX = {
  dealName: "Calvert Apartments",
  dealAddress: "470 Ormond Ave",
  dealCity: "Sharon",
  dealState: "PA",
  contactName: "John Seller",
  contactEmail: null,
  buyerEntity: "Dimand Holdings LLC",
  ddPeriodDays: 30,
  dataFields: [],
  offerStructures: [
    {
      structure_type: "seller_finance",
      name: "Seller Finance · 5% down",
      purchase_price: 105000000,
      down_payment: 5250000,
      financed_amount: 99750000,
      interest_rate: 5.5,
      term_years: 30,
      first_payment_defer_months: 2,
      has_balloon: false,
      is_recommended: true,
    },
  ],
};

// Claude now returns term values only — never prose
const TERMS_ONLY_RESPONSE = {
  content: [
    {
      type: "text",
      text: JSON.stringify({
        terms: [
          { id: "earnest_money", value: "$10,000", value_numeric: 1000000 },
          { id: "contingencies", value: null },
        ],
      }),
    },
  ],
};

describe("generateLOI (template-based)", () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue(TERMS_ONLY_RESPONSE);
  });

  it("returns sections filled from the locked template, not Claude prose", async () => {
    const { sections } = await generateLOI(CTX);
    const parties = sections.find((s) => s.id === "parties")!;
    // Exact template opening — locked prose
    expect(parties.content).toContain(
      'This Letter of Intent ("LOI") is entered into as of'
    );
    expect(parties.content).toContain('Dimand Holdings LLC ("Buyer")');
    expect(parties.content).toContain('John Seller ("Seller")');
    // The locked non-binding intent clause comes verbatim from the template
    const intent = sections.find((s) => s.id === "intent")!;
    expect(intent.content).toBe(LOI_SECTION_TEMPLATES.intent);
  });

  it("outputs all 10 canonical section IDs", async () => {
    const { sections } = await generateLOI(CTX);
    expect(sections.map((s) => s.id)).toEqual(SECTION_META.map((m) => m.id));
  });

  it("sections contain the offer price value from the terms", async () => {
    const { sections, terms } = await generateLOI(CTX);
    const offerPrice = terms.find((t) => t.id === "offer_price")!;
    expect(offerPrice.value).toBe("$1,050,000");
    const purchase = sections.find((s) => s.id === "purchase_price")!;
    expect(purchase.content).toContain("$1,050,000");
    expect(purchase.content).toContain("One Million Fifty Thousand Dollars");
    const financing = sections.find((s) => s.id === "financing_terms")!;
    expect(financing.content).toContain("$52,500");
    expect(financing.content).toContain("5.5% per annum");
    // Claude-extracted earnest money lands in the earnest money section
    const earnest = sections.find((s) => s.id === "earnest_money")!;
    expect(earnest.content).toContain("$10,000");
  });

  it("falls back to deterministic base terms when Claude fails", async () => {
    createMock.mockRejectedValue(new Error("API down"));
    const { sections, terms } = await generateLOI(CTX);
    expect(sections).toHaveLength(10);
    expect(terms.find((t) => t.id === "offer_price")!.value).toBe("$1,050,000");
    // earnest money stays a placeholder without Claude's extraction
    expect(sections.find((s) => s.id === "earnest_money")!.content).toContain(
      "[EARNEST MONEY AMOUNT]"
    );
  });
});
