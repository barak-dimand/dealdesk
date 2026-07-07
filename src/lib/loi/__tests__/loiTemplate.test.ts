import { describe, it, expect } from "vitest";
import {
  fillSection,
  fillAllSections,
  numberToWords,
  buildTermsFromPartial,
  SECTION_META,
} from "../loiTemplate";
import type { LOITerm } from "@/types";

function makeTerm(id: string, value: string | null): LOITerm {
  return {
    id,
    label: id,
    value,
    value_numeric: null,
    confidence: "inferred",
    source: null,
    is_required: false,
    affected_section_ids: [],
  };
}

const BASE_TERMS: LOITerm[] = [
  makeTerm("buyer_name_entity", "Dimand Holdings LLC"),
  makeTerm("seller_agent_name", "John Seller"),
  makeTerm("property_address", "470 Ormond Ave, Sharon, PA"),
  makeTerm("offer_price", "$1,050,000"),
  makeTerm("down_payment", "$52,500"),
  makeTerm("down_payment_pct", "5"),
  makeTerm("loan_amount", "$997,500"),
  makeTerm("interest_rate", "5.5"),
  makeTerm("loan_term", "30 years"),
  makeTerm("financing_structure", "Seller Financing"),
  makeTerm("earnest_money", "$10,000"),
];

describe("fillSection", () => {
  it("parties section fills buyer and seller names", () => {
    const out = fillSection("parties", BASE_TERMS);
    expect(out).toContain('This Letter of Intent ("LOI") is entered into as of');
    expect(out).toContain('Dimand Holdings LLC ("Buyer")');
    expect(out).toContain('John Seller ("Seller")');
    expect(out).toContain("470 Ormond Ave, Sharon, PA");
    expect(out).not.toContain("{{");
  });

  it("purchase_price section writes the price in words", () => {
    const out = fillSection("purchase_price", BASE_TERMS);
    expect(out).toContain("One Million Fifty Thousand Dollars ($1,050,000)");
  });

  it("financing_terms includes IO clause when a deferral period is set", () => {
    const terms = [...BASE_TERMS, makeTerm("first_payment_deferral", "2 months")];
    const out = fillSection("financing_terms", terms);
    expect(out).toContain("Interest-Only Period: The first 2 months following closing");
    expect(out).toContain("$997,500 at 5.5% per annum");
    expect(out).toContain("(5% of purchase price)");
  });

  it("financing_terms omits IO clause when deferral is None", () => {
    const terms = [...BASE_TERMS, makeTerm("first_payment_deferral", "None")];
    const out = fillSection("financing_terms", terms);
    expect(out).not.toContain("Interest-Only Period");
    // fully-amortizing balloon language instead
    expect(out).toContain("shall fully amortize over the 30 years term");
  });

  it("missing required terms render as [PLACEHOLDER], not empty string", () => {
    const parties = fillSection("parties", []);
    expect(parties).toContain("[BUYER NAME / ENTITY]");
    expect(parties).toContain("[SELLER NAME]");
    expect(parties).toContain("[PROPERTY ADDRESS]");
    const earnest = fillSection("earnest_money", []);
    expect(earnest).toContain("[EARNEST MONEY AMOUNT]");
    expect(earnest).toContain("[TITLE COMPANY]");
    expect(parties).not.toContain("{{");
  });
});

describe("numberToWords", () => {
  it("converts common real estate amounts correctly", () => {
    expect(numberToWords(285000)).toBe("Two Hundred Eighty-Five Thousand");
    expect(numberToWords(1050000)).toBe("One Million Fifty Thousand");
    expect(numberToWords(1125000)).toBe("One Million One Hundred Twenty-Five Thousand");
    expect(numberToWords(270000)).toBe("Two Hundred Seventy Thousand");
    expect(numberToWords(450000)).toBe("Four Hundred Fifty Thousand");
  });
});

describe("fillAllSections / buildTermsFromPartial", () => {
  it("produces all 10 canonical sections in order", () => {
    const sections = fillAllSections(BASE_TERMS);
    expect(sections.map((s) => s.id)).toEqual(SECTION_META.map((m) => m.id));
    expect(sections).toHaveLength(10);
    expect(sections[0].sort_order).toBe(1);
    expect(sections[9].sort_order).toBe(10);
  });

  it("buildTermsFromPartial merges defaults with provided chat terms", () => {
    const terms = buildTermsFromPartial([
      { id: "offer_price", value: "$270,000", value_numeric: 27000000 },
      { id: "interest_rate", value: "6" },
    ]);
    const byId = Object.fromEntries(terms.map((t) => [t.id, t]));
    expect(byId.offer_price.value).toBe("$270,000");
    expect(byId.offer_price.value_numeric).toBe(27000000);
    // defaults fill in
    expect(byId.due_diligence_period.value).toBe("30 days");
    expect(byId.closing_timeline.value).toBe("45 days from execution");
    expect(byId.first_payment_deferral.value).toBe("None");
    // unspecified required terms are missing
    expect(byId.earnest_money.confidence).toBe("missing");
    // non-standard id passes through as a hidden extra term
    expect(byId.interest_rate.value).toBe("6");
  });
});
