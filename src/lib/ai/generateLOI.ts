import Anthropic from "@anthropic-ai/sdk";
import type { LOITerm, LOISection } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface LOIContext {
  dealName: string;
  dealAddress: string | null;
  dealCity: string | null;
  dealState: string | null;
  contactName: string | null;
  contactEmail: string | null;
  buyerEntity: string | null;
  ddPeriodDays: number | null;
  dataFields: Array<{
    field_key: string;
    field_value: string | null;
    field_value_numeric: number | null;
  }>;
  offerStructures: Array<{
    structure_type: string;
    name: string;
    purchase_price: number | null;
    down_payment: number | null;
    financed_amount: number | null;
    interest_rate: number | null;
    term_years: number | null;
    first_payment_defer_months: number;
    has_balloon: boolean;
    is_recommended: boolean;
  }>;
}

interface LOIGenerationResult {
  terms: LOITerm[];
  sections: LOISection[];
}

function formatCents(cents: number | null): string | null {
  if (cents == null) return null;
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

// A value is "missing" if null, empty, or a bracketed placeholder like [BUYER NAME]
function isMissingValue(v: string | null | undefined): boolean {
  if (!v) return true;
  return v.startsWith("[");
}

// ─── fallback fixture (used when Claude returns unparseable JSON) ─────────────

function generateLOIMock(ctx: LOIContext): LOIGenerationResult {
  const recommended =
    ctx.offerStructures.find((o) => o.is_recommended) ??
    ctx.offerStructures[0] ??
    null;

  const propertyLine =
    [ctx.dealAddress, ctx.dealCity, ctx.dealState].filter(Boolean).join(", ") ||
    "the above-referenced property";
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const terms: LOITerm[] = [
    {
      id: "offer_price",
      label: "Offer Price",
      value: formatCents(recommended?.purchase_price ?? null),
      value_numeric: recommended?.purchase_price ?? null,
      confidence: recommended ? "inferred" : "missing",
      source: recommended ? "Pulled from recommendation engine" : null,
      is_required: true,
      affected_section_ids: ["purchase_price", "financing_terms"],
    },
    {
      id: "financing_structure",
      label: "Financing Structure",
      value: recommended?.name ?? null,
      value_numeric: null,
      confidence: recommended ? "inferred" : "missing",
      source: recommended ? "Pulled from recommendation engine" : null,
      is_required: true,
      affected_section_ids: ["financing_terms"],
    },
    {
      id: "down_payment",
      label: "Down Payment",
      value: formatCents(recommended?.down_payment ?? null),
      value_numeric: recommended?.down_payment ?? null,
      confidence: recommended ? "inferred" : "missing",
      source: recommended ? "Pulled from recommendation engine" : null,
      is_required: false,
      affected_section_ids: ["financing_terms"],
    },
    {
      id: "loan_amount",
      label: "Loan Amount",
      value: formatCents(recommended?.financed_amount ?? null),
      value_numeric: recommended?.financed_amount ?? null,
      confidence: recommended ? "inferred" : "missing",
      source: recommended ? "Pulled from recommendation engine" : null,
      is_required: false,
      affected_section_ids: ["financing_terms"],
    },
    {
      id: "loan_term",
      label: "Loan Term",
      value: recommended?.term_years ? `${recommended.term_years} years` : null,
      value_numeric: null,
      confidence: recommended?.term_years ? "inferred" : "missing",
      source: recommended ? "Pulled from recommendation engine" : null,
      is_required: false,
      affected_section_ids: ["financing_terms"],
    },
    {
      id: "first_payment_deferral",
      label: "First Payment Deferral",
      value: recommended?.first_payment_defer_months
        ? `${recommended.first_payment_defer_months} months`
        : "None",
      value_numeric: null,
      confidence: "inferred",
      source: "Pulled from recommendation engine",
      is_required: false,
      affected_section_ids: ["financing_terms"],
    },
    {
      id: "balloon_prepayment",
      label: "Balloon / Prepayment",
      value: recommended?.has_balloon ? "Balloon included" : "None",
      value_numeric: null,
      confidence: "inferred",
      source: "Pulled from recommendation engine",
      is_required: false,
      affected_section_ids: ["financing_terms"],
    },
    {
      id: "earnest_money",
      label: "Earnest Money Deposit",
      value: null,
      value_numeric: null,
      confidence: "missing",
      source: null,
      is_required: true,
      affected_section_ids: ["earnest_money"],
    },
    {
      id: "due_diligence_period",
      label: "Due Diligence Period",
      value: `${ctx.ddPeriodDays ?? 30} days`,
      value_numeric: null,
      confidence: "verified",
      source: ctx.ddPeriodDays ? "User settings" : "User default",
      is_required: true,
      affected_section_ids: ["due_diligence"],
    },
    {
      id: "closing_timeline",
      label: "Closing Timeline",
      value: "45 days from execution",
      value_numeric: null,
      confidence: "verified",
      source: "User default",
      is_required: true,
      affected_section_ids: ["closing"],
    },
    {
      id: "contingencies",
      label: "Contingencies",
      value: null,
      value_numeric: null,
      confidence: "missing",
      source: null,
      is_required: false,
      affected_section_ids: ["contingencies"],
    },
    {
      id: "buyer_name_entity",
      label: "Buyer Name / Entity",
      value: ctx.buyerEntity ?? null,
      value_numeric: null,
      confidence: ctx.buyerEntity ? "verified" : "missing",
      source: ctx.buyerEntity ? "User settings" : "Pull from user profile",
      is_required: true,
      affected_section_ids: ["parties", "signature"],
    },
    {
      id: "seller_agent_name",
      label: "Seller / Agent Name",
      value: ctx.contactName,
      value_numeric: null,
      confidence: ctx.contactName ? "inferred" : "missing",
      source: ctx.contactName ? "Parsed from deal contact" : null,
      is_required: true,
      affected_section_ids: ["parties"],
    },
    {
      id: "seller_agent_email",
      label: "Seller / Agent Email",
      value: ctx.contactEmail,
      value_numeric: null,
      confidence: ctx.contactEmail ? "verified" : "missing",
      source: ctx.contactEmail ? "User-entered" : null,
      is_required: true,
      affected_section_ids: [],
    },
    {
      id: "commission_handling",
      label: "Commission Handling",
      value: null,
      value_numeric: null,
      confidence: "missing",
      source: null,
      is_required: false,
      affected_section_ids: ["contingencies"],
    },
  ];

  const offerPriceStr = formatCents(recommended?.purchase_price ?? null) ?? "[OFFER PRICE]";
  const downStr = formatCents(recommended?.down_payment ?? null) ?? "[DOWN PAYMENT]";
  const loanStr = formatCents(recommended?.financed_amount ?? null) ?? "[LOAN AMOUNT]";
  const termStr = recommended?.term_years ? `${recommended.term_years} years` : "[LOAN TERM]";
  const deferMonths = recommended?.first_payment_defer_months ?? 0;
  const deferStr = deferMonths > 0 ? `${deferMonths} months` : null;

  const sections: LOISection[] = [
    {
      id: "parties",
      label: "Date & Parties",
      content: `This Letter of Intent ("LOI") is entered into as of ${today} by and between ${ctx.buyerEntity ?? "[BUYER NAME / ENTITY]"} ("Buyer") and ${ctx.contactName ?? "[SELLER NAME]"} ("Seller"), with respect to the real property commonly known as ${propertyLine} (the "Property").`,
      sort_order: 1,
    },
    {
      id: "intent",
      label: "Subject & Intent",
      content: `Buyer hereby expresses its non-binding intent to acquire the Property subject to the terms outlined below. This LOI does not constitute a binding contract and is intended solely as a basis for negotiation of a definitive Purchase and Sale Agreement.`,
      sort_order: 2,
    },
    {
      id: "purchase_price",
      label: "Purchase Price",
      content: `The proposed purchase price for the Property is ${offerPriceStr}. This price reflects current market conditions, in-place income, and the operating profile of the asset as presented.`,
      sort_order: 3,
    },
    {
      id: "financing_terms",
      label: "Financing Terms",
      content: [
        "Buyer proposes the following financing structure:",
        "",
        `• Structure: ${recommended?.name ?? "[FINANCING STRUCTURE]"}`,
        `• Purchase Price: ${offerPriceStr}`,
        `• Down Payment: ${downStr}`,
        `• Seller-Carried Note: ${loanStr}`,
        `• Term: ${termStr}`,
        ...(deferStr ? [`• First Payment Deferral: ${deferStr}`] : []),
        `• Balloon: ${recommended?.has_balloon ? "Yes" : "None"}`,
        "",
        "Specific rate, amortization, and payment schedule to be detailed in the Purchase and Sale Agreement.",
      ].join("\n"),
      sort_order: 4,
    },
    {
      id: "earnest_money",
      label: "Earnest Money",
      content: `Buyer shall deposit [EARNEST MONEY AMOUNT] as earnest money within 3 business days of execution of the Purchase and Sale Agreement. Earnest money shall be held in escrow by [TITLE COMPANY] and shall be refundable during the Due Diligence Period.`,
      sort_order: 5,
    },
    {
      id: "due_diligence",
      label: "Due Diligence Period",
      content: `Buyer shall have ${ctx.ddPeriodDays ?? 30} days from the execution of the Purchase and Sale Agreement to conduct its due diligence, including but not limited to: physical inspection, review of all financial records (T12, rent roll, leases), environmental assessment, and title review. During this period, earnest money shall be fully refundable at Buyer's sole discretion.`,
      sort_order: 6,
    },
    {
      id: "closing",
      label: "Closing",
      content: `The closing of this transaction shall occur within 45 days from the execution of the Purchase and Sale Agreement, or such other date as mutually agreed by both parties. Closing shall take place through a title company mutually acceptable to both parties.`,
      sort_order: 7,
    },
    {
      id: "contingencies",
      label: "Contingencies",
      content: `This LOI and any resulting Purchase and Sale Agreement shall be contingent upon:\n\n• Buyer's satisfactory review of all financial statements and operating records\n• Buyer's satisfactory physical inspection of the Property\n• Seller's delivery of all requested documents within 5 business days of execution\n\n[Additional contingencies to be added based on due diligence findings]`,
      sort_order: 8,
    },
    {
      id: "expiration",
      label: "Expiration",
      content: `This LOI shall expire at 5:00 PM local time, 5 business days from the date above, unless accepted in writing by Seller prior to such time.`,
      sort_order: 9,
    },
    {
      id: "signature",
      label: "Signature Block",
      content: `Respectfully submitted,\n\n[BUYER NAME]\n[ENTITY NAME]\nDate: ${today}\n\n\n_________________________\nSeller Acknowledgment\nDate: ___________________`,
      sort_order: 10,
    },
  ];

  return { terms, sections };
}

// ─── real Claude implementation ───────────────────────────────────────────────

export async function generateLOI(ctx: LOIContext): Promise<LOIGenerationResult> {
  const recommended =
    ctx.offerStructures.find((o) => o.is_recommended) ??
    ctx.offerStructures[0] ??
    null;

  const propertyLine =
    [ctx.dealAddress, ctx.dealCity, ctx.dealState].filter(Boolean).join(", ") ||
    "the above-referenced property";
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fieldLines = ctx.dataFields
    .map(
      (f) =>
        `  ${f.field_key}: ${f.field_value ?? (f.field_value_numeric != null ? String(f.field_value_numeric) : "N/A")}`
    )
    .join("\n");

  const deferMonths = recommended?.first_payment_defer_months ?? 0;

  const offerStructureLines = recommended
    ? [
        `  Name: ${recommended.name}`,
        `  Structure type: ${recommended.structure_type}`,
        `  Purchase price: ${formatCents(recommended.purchase_price) ?? "N/A"}`,
        `  Down payment: ${formatCents(recommended.down_payment) ?? "N/A"}`,
        `  Financed amount: ${formatCents(recommended.financed_amount) ?? "N/A"}`,
        `  Interest rate: ${recommended.interest_rate != null ? `${recommended.interest_rate}%` : "N/A"}`,
        `  Term: ${recommended.term_years != null ? `${recommended.term_years} years` : "N/A"}`,
        `  First payment deferral: ${deferMonths > 0 ? `${deferMonths} months` : "None"}`,
        `  Balloon: ${recommended.has_balloon ? "Yes" : "None"}`,
      ].join("\n")
    : "  No offer structure provided";

  const systemPrompt = `You are a real estate Letter of Intent drafting assistant. Generate a complete professional LOI as valid JSON only. Use exact numbers from the deal data — no placeholders for values you actually have. Only use [PLACEHOLDER TEXT] syntax for values genuinely missing from the input (buyer entity name, earnest money amount, title company). Return only the JSON object, no markdown, no explanation, no code fences.

The 'parties' section must be formatted as a professional letter opening paragraph — NOT as a memo with To:/From:/Email:/Re: fields. It should read as flowing prose that names the buyer entity, the seller, and the property address. Example format: 'This Letter of Intent ("LOI") is entered into as of [date] by and between [BUYER NAME / ENTITY] ("Buyer") and [SELLER NAME] ("Seller"), with respect to the real property commonly known as [Property Address], [City], [State] (the "Property").'`;

  const ddDays = ctx.ddPeriodDays ?? 30;
  const buyerEntityStr = ctx.buyerEntity ?? null;

  const userPrompt = `Generate a Letter of Intent for this deal. Today's date: ${today}

DEAL: ${ctx.dealName}
Property: ${propertyLine}
Seller / Agent: ${ctx.contactName ?? "[SELLER NAME]"}
Seller email: ${ctx.contactEmail ?? "[SELLER EMAIL]"}
Buyer entity: ${buyerEntityStr ?? "[BUYER NAME / ENTITY] (unknown — use placeholder)"}
Due diligence period: ${ddDays} days

OFFER STRUCTURE (recommended):
${offerStructureLines}

DEAL DATA FIELDS:
${fieldLines || "  No additional fields"}

Return a JSON object with exactly this shape. Use real values where available; use null (not a string) when a value is genuinely unavailable:
{
  "terms": [
    { "id": "offer_price", "value": "<dollar amount, e.g. '$450,000'>" },
    { "id": "financing_structure", "value": "<structure description>" },
    { "id": "down_payment", "value": "<dollar amount or null>" },
    { "id": "loan_amount", "value": "<dollar amount or null>" },
    { "id": "loan_term", "value": "<e.g. '30 years' or null>" },
    { "id": "first_payment_deferral", "value": "<e.g. '2 months' — or 'None' if no deferral>" },
    { "id": "balloon_prepayment", "value": "<'Balloon included' or 'None'>" },
    { "id": "earnest_money", "value": null },
    { "id": "due_diligence_period", "value": "${ddDays} days" },
    { "id": "closing_timeline", "value": "45 days from execution" },
    { "id": "contingencies", "value": null },
    { "id": "buyer_name_entity", "value": ${JSON.stringify(buyerEntityStr)} },
    { "id": "seller_agent_name", "value": ${JSON.stringify(ctx.contactName)} },
    { "id": "seller_agent_email", "value": ${JSON.stringify(ctx.contactEmail)} },
    { "id": "commission_handling", "value": null }
  ],
  "sections": [
    { "id": "parties", "content": "<full section text — use today's date ${today}, buyer entity name if provided, real seller name if available, real property address>" },
    { "id": "intent", "content": "<full non-binding intent clause>" },
    { "id": "purchase_price", "content": "<purchase price section — use exact dollar amount>" },
    { "id": "financing_terms", "content": "<full financing terms — use exact numbers from offer structure; omit the first payment deferral bullet if deferral is None>" },
    { "id": "earnest_money", "content": "<earnest money clause — use [EARNEST MONEY AMOUNT] and [TITLE COMPANY] placeholders>" },
    { "id": "due_diligence", "content": "<${ddDays}-day due diligence clause>" },
    { "id": "closing", "content": "<45-day closing clause>" },
    { "id": "contingencies", "content": "<standard contingencies clause>" },
    { "id": "expiration", "content": "<5-business-day LOI expiration clause>" },
    { "id": "signature", "content": "<signature block — use buyer entity name if provided, else [BUYER NAME] / [ENTITY NAME] placeholders; include today's date ${today}>" }
  ]
}`;

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 8096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const rawText =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Strip markdown code fences Claude sometimes adds
  const cleaned = rawText
    .replace(/^```json?\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[generateLOI] No JSON in Claude response:", rawText.slice(0, 800));
    return generateLOIMock(ctx);
  }

  let raw: {
    terms?: Array<{ id: string; value: string | null }>;
    sections?: Array<{ id: string; content: string }>;
  };
  try {
    raw = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("[generateLOI] JSON parse error:", e, "\nJSON:", jsonMatch[0].slice(0, 800));
    return generateLOIMock(ctx);
  }

  // Get the base structure (correct metadata: is_required, affected_section_ids, value_numeric, etc.)
  // then overlay Claude's content where provided.
  const mockResult = generateLOIMock(ctx);
  const termValueMap = new Map((raw.terms ?? []).map((t) => [t.id, t.value]));
  const sectionContentMap = new Map((raw.sections ?? []).map((s) => [s.id, s.content]));

  const terms: LOITerm[] = mockResult.terms.map((term) => {
    if (!termValueMap.has(term.id)) return term;
    const claudeValue = termValueMap.get(term.id) ?? null;
    const isActualValue = !isMissingValue(claudeValue);
    return {
      ...term,
      value: claudeValue,
      // Upgrade "missing" to "inferred" when Claude provides a real value;
      // preserve "verified" and existing "inferred" states unchanged.
      confidence:
        term.confidence === "missing" && isActualValue ? "inferred" : term.confidence,
      source: isActualValue ? "Generated by AI from deal data" : term.source,
    };
  });

  const sections: LOISection[] = mockResult.sections.map((section) => {
    const claudeContent = sectionContentMap.get(section.id);
    if (!claudeContent) return section;
    return { ...section, content: claudeContent };
  });

  return { terms, sections };
}
