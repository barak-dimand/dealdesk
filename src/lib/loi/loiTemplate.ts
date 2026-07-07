import type { LOITerm, LOISection } from "@/types";

// ─── Canonical LOI structure ────────────────────────────────────────────────
// The prose is LOCKED. Only {{placeholder}} values change between versions,
// so users can diff versions by the numbers rather than re-reading legalese.

export const LOI_SECTION_TEMPLATES: Record<string, string> = {
  parties: `This Letter of Intent ("LOI") is entered into as of {{date}} by and between {{buyer_name_entity}} ("Buyer") and {{seller_agent_name}} ("Seller"), with respect to the real property commonly known as {{property_address}} (the "Property").`,

  intent: `This LOI sets forth the principal terms and conditions under which Buyer proposes to purchase the Property from Seller. This document is intended solely as a non-binding expression of interest and shall not create any legal obligation on either party, except with respect to the confidentiality and exclusivity provisions set forth herein. A definitive Purchase and Sale Agreement ("PSA") shall be negotiated and executed by both parties to memorialize the binding terms of the transaction.`,

  purchase_price: `Buyer offers a total purchase price of {{offer_price_written}} ({{offer_price}}) for the Property, payable as set forth in the Financing Terms section below. This offer reflects Buyer's assessment of the Property's current in-place performance and identified value-add opportunities{{purchase_price_context}}.`,

  financing_terms: `The purchase price shall be paid as follows:\n\n• Down Payment: {{down_payment}} ({{down_payment_pct}}% of purchase price), payable in cash at closing.\n• {{financing_label}}: {{loan_amount}} at {{interest_rate}}% per annum, fixed.\n• Amortization / Term: {{amortization_description}}.\n{{interest_only_clause}}{{balloon_clause}}• Security: The Seller Note shall be secured by a first-position mortgage/deed of trust against the Property.\n• Prepayment: Buyer shall have the right to prepay the Seller Note in whole or in part at any time without penalty.\n\nSpecific rate, amortization, and payment schedule to be detailed in the PSA.`,

  earnest_money: `Within {{earnest_money_days}} business days following full execution of the PSA, Buyer shall deposit {{earnest_money}} ("Earnest Money") with {{title_company}} ("Escrow Holder"), to be held in escrow and applied toward the purchase price at closing. The Earnest Money shall be fully refundable upon expiration of the Due Diligence Period, except in the event of Buyer default or failure of a closing condition.`,

  due_diligence: `Buyer shall have a due diligence period of {{dd_period}} days following the execution of the PSA (the "Due Diligence Period") to inspect the Property and review all relevant materials, including but not limited to: rent rolls, leases, trailing 12-month operating statements, tax bills, utility records, service contracts, insurance loss runs, environmental reports, and any other documentation reasonably requested. Seller agrees to deliver such materials within five (5) business days of PSA execution. Buyer may terminate the PSA for any reason during the Due Diligence Period and receive a full refund of earnest money.`,

  closing: `Closing shall occur within {{closing_timeline}} days following the execution of the PSA, or such earlier date as the parties may mutually agree. At closing, Seller shall convey marketable, fee simple title to the Property by general warranty deed, free and clear of all liens and encumbrances other than those expressly approved by Buyer during the title review.`,

  contingencies: `Closing shall be subject to customary contingencies, including but not limited to: (i) Buyer's satisfactory completion of physical, financial, and legal due diligence; (ii) review and approval of title commitment and survey; (iii) review of all leases, rent rolls, and operating records; (iv) confirmation of financing terms substantially as described herein; (v) absence of material adverse change to the Property or its operations between PSA execution and closing; and (vi) negotiation and execution of mutually acceptable PSA and mortgage/security documents.{{additional_contingencies}}`,

  expiration: `This LOI shall expire if not accepted and countersigned by Seller by 5:00 PM Eastern Time on the fifth (5th) business day following the date first written above. Upon acceptance, the parties shall proceed in good faith to negotiate and execute a definitive PSA consistent with the terms outlined herein.`,

  signature: `Respectfully submitted,\n\n{{buyer_name_entity}}\n{{buyer_entity}}\nDate: {{date}}\n\n\nACCEPTED AND AGREED:\n\n{{seller_agent_name}}\nDate: ___________________`,
};

export const SECTION_META: Array<{ id: string; label: string; sort_order: number }> = [
  { id: "parties", label: "Date & Parties", sort_order: 1 },
  { id: "intent", label: "Subject & Intent", sort_order: 2 },
  { id: "purchase_price", label: "Purchase Price", sort_order: 3 },
  { id: "financing_terms", label: "Financing Terms", sort_order: 4 },
  { id: "earnest_money", label: "Earnest Money", sort_order: 5 },
  { id: "due_diligence", label: "Due Diligence Period", sort_order: 6 },
  { id: "closing", label: "Closing", sort_order: 7 },
  { id: "contingencies", label: "Contingencies", sort_order: 8 },
  { id: "expiration", label: "Expiration", sort_order: 9 },
  { id: "signature", label: "Signature Block", sort_order: 10 },
];

// Placeholders that must be filled for a complete LOI
export const LOI_REQUIRED_PLACEHOLDERS = [
  "buyer_name_entity",
  "seller_agent_name",
  "offer_price",
  "earnest_money",
];

// ─── number → words (correct for the 1k–999M real estate range) ─────────────

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven",
  "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen",
  "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty",
  "Sixty", "Seventy", "Eighty", "Ninety"];

function belowThousand(n: number): string {
  let out = "";
  if (n >= 100) {
    out += ONES[Math.floor(n / 100)] + " Hundred";
    n %= 100;
    if (n) out += " ";
  }
  if (n >= 20) {
    out += TENS[Math.floor(n / 10)];
    if (n % 10) out += "-" + ONES[n % 10];
  } else if (n > 0) {
    out += ONES[n];
  }
  return out;
}

export function numberToWords(n: number): string {
  if (n === 0) return "Zero";
  let out = "";
  if (n >= 1000000) {
    out += belowThousand(Math.floor(n / 1000000)) + " Million";
    n %= 1000000;
    if (n) out += " ";
  }
  if (n >= 1000) {
    out += belowThousand(Math.floor(n / 1000)) + " Thousand";
    n %= 1000;
    if (n) out += " ";
  }
  if (n > 0) out += belowThousand(n);
  return out.trim();
}

export function toWrittenDollars(value: string | undefined): string {
  if (!value) return "[OFFER PRICE IN WORDS]";
  const num = parseInt(value.replace(/[$,]/g, ""), 10);
  if (isNaN(num)) return value;
  return numberToWords(num) + " Dollars";
}

// ─── clause helpers ──────────────────────────────────────────────────────────

function termValueMap(terms: LOITerm[]): Record<string, string> {
  return Object.fromEntries(terms.map((t) => [t.id, t.value ?? ""]));
}

function getFinancingLabel(structure: string | undefined): string {
  if (!structure) return "Seller-Carried Note";
  const s = structure.toLowerCase();
  if (s.includes("seller")) return "Seller-Carried Note";
  if (s.includes("conventional")) return "Conventional Loan";
  if (s.includes("hard money")) return "Hard Money Loan";
  return "Financed Amount";
}

function getAmortizationDesc(termMap: Record<string, string>): string {
  const years = termMap.loan_term || "30 years";
  const io = termMap.interest_only_period || termMap.first_payment_deferral;
  if (io && io !== "None" && io !== "0") {
    return `${years} amortization schedule with interest-only period as described above`;
  }
  return `${years} amortization schedule`;
}

function getIOClause(termMap: Record<string, string>): string {
  const io = termMap.interest_only_period || termMap.first_payment_deferral;
  if (!io || io === "None" || io === "0") return "";
  return `• Interest-Only Period: The first ${io} following closing shall be interest-only, with principal-and-interest amortization commencing thereafter.\n`;
}

function getBalloonClause(termMap: Record<string, string>): string {
  const balloon = termMap.balloon_prepayment;
  if (!balloon || balloon === "None") {
    return `• Balloon: The Seller Note shall fully amortize over the ${termMap.loan_term || "30-year"} term.\n`;
  }
  return `• Balloon: ${balloon}.\n`;
}

function getAdditionalContingencies(termMap: Record<string, string>): string {
  if (termMap.contingencies && termMap.contingencies !== "None") {
    return ` Additional contingencies: ${termMap.contingencies}.`;
  }
  return "";
}

// ─── fill ────────────────────────────────────────────────────────────────────

export function fillSection(sectionId: string, terms: LOITerm[]): string {
  const template = LOI_SECTION_TEMPLATES[sectionId] ?? "";
  const termMap = termValueMap(terms);

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const replacements: Record<string, string> = {
    date: today,
    buyer_name_entity: termMap.buyer_name_entity || "[BUYER NAME / ENTITY]",
    buyer_entity: termMap.buyer_entity || "[ENTITY NAME]",
    seller_agent_name: termMap.seller_agent_name || "[SELLER NAME]",
    property_address: termMap.property_address || "[PROPERTY ADDRESS]",
    offer_price: termMap.offer_price || "[OFFER PRICE]",
    offer_price_written: toWrittenDollars(termMap.offer_price || undefined),
    down_payment: termMap.down_payment || "[DOWN PAYMENT]",
    down_payment_pct: termMap.down_payment_pct || "[DOWN PAYMENT %]",
    loan_amount: termMap.loan_amount || "[LOAN AMOUNT]",
    interest_rate: termMap.interest_rate || "[INTEREST RATE]",
    financing_label: getFinancingLabel(termMap.financing_structure),
    amortization_description: getAmortizationDesc(termMap),
    interest_only_clause: getIOClause(termMap),
    balloon_clause: getBalloonClause(termMap),
    earnest_money: termMap.earnest_money || "[EARNEST MONEY AMOUNT]",
    earnest_money_days: "3",
    title_company: "[TITLE COMPANY]",
    dd_period: (termMap.due_diligence_period || "30 days").replace(/\s*days.*$/i, "") || "30",
    closing_timeline:
      (termMap.closing_timeline || "45 days from execution").replace(/\s*days.*$/i, "") || "45",
    purchase_price_context: "",
    additional_contingencies: getAdditionalContingencies(termMap),
  };

  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
    replacements[key] !== undefined ? replacements[key] : `[${key.toUpperCase()}]`
  );
}

/** Build all 10 sections from the locked template. */
export function fillAllSections(terms: LOITerm[]): LOISection[] {
  return SECTION_META.map((meta) => ({
    id: meta.id,
    label: meta.label,
    content: fillSection(meta.id, terms),
    sort_order: meta.sort_order,
  }));
}

// ─── standard term scaffold (chat drafts arrive as partial term values) ─────

const STANDARD_TERM_DEFS: Array<
  Pick<LOITerm, "id" | "label" | "is_required" | "affected_section_ids"> & {
    defaultValue?: string;
  }
> = [
  { id: "offer_price", label: "Offer Price", is_required: true, affected_section_ids: ["purchase_price", "financing_terms"] },
  { id: "financing_structure", label: "Financing Structure", is_required: true, affected_section_ids: ["financing_terms"] },
  { id: "down_payment", label: "Down Payment", is_required: false, affected_section_ids: ["financing_terms"] },
  { id: "loan_amount", label: "Loan Amount", is_required: false, affected_section_ids: ["financing_terms"] },
  { id: "loan_term", label: "Loan Term", is_required: false, affected_section_ids: ["financing_terms"] },
  { id: "first_payment_deferral", label: "First Payment Deferral", is_required: false, affected_section_ids: ["financing_terms"], defaultValue: "None" },
  { id: "balloon_prepayment", label: "Balloon / Prepayment", is_required: false, affected_section_ids: ["financing_terms"], defaultValue: "None" },
  { id: "earnest_money", label: "Earnest Money Deposit", is_required: true, affected_section_ids: ["earnest_money"] },
  { id: "due_diligence_period", label: "Due Diligence Period", is_required: true, affected_section_ids: ["due_diligence"], defaultValue: "30 days" },
  { id: "closing_timeline", label: "Closing Timeline", is_required: true, affected_section_ids: ["closing"], defaultValue: "45 days from execution" },
  { id: "contingencies", label: "Contingencies", is_required: false, affected_section_ids: ["contingencies"] },
  { id: "buyer_name_entity", label: "Buyer Name / Entity", is_required: true, affected_section_ids: ["parties", "signature"] },
  { id: "seller_agent_name", label: "Seller / Agent Name", is_required: true, affected_section_ids: ["parties"] },
  { id: "seller_agent_email", label: "Seller / Agent Email", is_required: true, affected_section_ids: [] },
  { id: "commission_handling", label: "Commission Handling", is_required: false, affected_section_ids: ["contingencies"] },
];

export interface PartialLOITerm {
  id: string;
  value?: string | null;
  value_numeric?: number | null;
}

/**
 * Builds the full standard 15-term list, overlaying values from a partial
 * list (e.g. an loi_draft chat proposal) on top of sensible defaults.
 * Unknown ids in the partial list pass through as hidden extra terms
 * (they fill template placeholders but don't render in the term panel).
 */
export function buildTermsFromPartial(partial: PartialLOITerm[]): LOITerm[] {
  const byId = new Map(partial.map((p) => [p.id, p]));

  const standard: LOITerm[] = STANDARD_TERM_DEFS.map((def) => {
    const provided = byId.get(def.id);
    const value = provided?.value ?? def.defaultValue ?? null;
    return {
      id: def.id,
      label: def.label,
      value,
      value_numeric: provided?.value_numeric ?? null,
      confidence: provided?.value
        ? "inferred"
        : def.defaultValue
          ? "verified"
          : "missing",
      source: provided?.value
        ? "From chat"
        : def.defaultValue
          ? "User default"
          : null,
      is_required: def.is_required,
      affected_section_ids: def.affected_section_ids,
    };
  });

  const standardIds = new Set(STANDARD_TERM_DEFS.map((d) => d.id));
  const extras: LOITerm[] = partial
    .filter((p) => !standardIds.has(p.id))
    .map((p) => ({
      id: p.id,
      label: p.id.replace(/_/g, " "),
      value: p.value ?? null,
      value_numeric: p.value_numeric ?? null,
      confidence: "inferred",
      source: "From chat",
      is_required: false,
      affected_section_ids: [],
    }));

  return [...standard, ...extras];
}
