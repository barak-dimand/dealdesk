import Anthropic from "@anthropic-ai/sdk";
import { fillAllSections } from "@/lib/loi/loiTemplate";
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

// ─── deterministic base terms from deal data ─────────────────────────────────
// The visible 15 terms plus hidden template-only terms (property_address,
// interest_rate, down_payment_pct, buyer_entity) that fill placeholders but
// are not listed in the LOI term panel.

function buildBaseTerms(ctx: LOIContext): LOITerm[] {
  const recommended =
    ctx.offerStructures.find((o) => o.is_recommended) ??
    ctx.offerStructures[0] ??
    null;

  const propertyLine =
    [ctx.dealAddress, ctx.dealCity, ctx.dealState].filter(Boolean).join(", ") ||
    "the above-referenced property";

  const downPct =
    recommended?.purchase_price && recommended?.down_payment != null
      ? String(Math.round((recommended.down_payment / recommended.purchase_price) * 100))
      : null;

  return [
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
    // Hidden template-only terms (not shown in the term panel)
    {
      id: "property_address",
      label: "Property Address",
      value: propertyLine,
      value_numeric: null,
      confidence: "verified",
      source: "Deal record",
      is_required: false,
      affected_section_ids: ["parties"],
    },
    {
      id: "interest_rate",
      label: "Interest Rate",
      value: recommended?.interest_rate != null ? String(recommended.interest_rate) : null,
      value_numeric: null,
      confidence: recommended?.interest_rate != null ? "inferred" : "missing",
      source: recommended ? "Pulled from recommendation engine" : null,
      is_required: false,
      affected_section_ids: ["financing_terms"],
    },
    {
      id: "down_payment_pct",
      label: "Down Payment %",
      value: downPct,
      value_numeric: null,
      confidence: downPct ? "inferred" : "missing",
      source: downPct ? "Computed from offer structure" : null,
      is_required: false,
      affected_section_ids: ["financing_terms"],
    },
    {
      id: "buyer_entity",
      label: "Buyer Entity",
      value: ctx.buyerEntity ?? null,
      value_numeric: null,
      confidence: ctx.buyerEntity ? "verified" : "missing",
      source: ctx.buyerEntity ? "User settings" : null,
      is_required: false,
      affected_section_ids: ["signature"],
    },
  ];
}

// ─── generation: Claude extracts term VALUES only; prose comes from the
// locked template in src/lib/loi/loiTemplate.ts ─────────────────────────────

export async function generateLOI(ctx: LOIContext): Promise<LOIGenerationResult> {
  const baseTerms = buildBaseTerms(ctx);

  const fieldLines = ctx.dataFields
    .map(
      (f) =>
        `  ${f.field_key}: ${f.field_value ?? (f.field_value_numeric != null ? String(f.field_value_numeric) : "N/A")}`
    )
    .join("\n");

  const baseTermLines = baseTerms
    .map((t) => `  ${t.id}: ${t.value ?? "null"}`)
    .join("\n");

  const systemPrompt = `You are a real estate LOI terms extractor. Given the deal data, extract the specific values for each LOI term. Return ONLY valid JSON — no prose, no explanation, no markdown, no code fences.

Return this exact shape:
{
  "terms": [
    { "id": "offer_price", "value": "$1,050,000", "value_numeric": 105000000, "confidence": "verified|inferred|missing" }
  ]
}

Include an entry for every term id you can determine a value for. Use null for values genuinely missing from the deal data. value_numeric is in cents for money terms, null otherwise.
Do not write any LOI prose. Only extract term values from the deal data provided.`;

  const userPrompt = `Extract LOI term values for this deal.

DEAL: ${ctx.dealName}
Property: ${[ctx.dealAddress, ctx.dealCity, ctx.dealState].filter(Boolean).join(", ") || "unknown"}
Seller / Agent: ${ctx.contactName ?? "unknown"}
Seller email: ${ctx.contactEmail ?? "unknown"}
Buyer entity: ${ctx.buyerEntity ?? "unknown"}
Due diligence period: ${ctx.ddPeriodDays ?? 30} days

CURRENT BASE TERM VALUES (derived from the offer structure — refine or fill gaps only where the deal data supports it):
${baseTermLines}

DEAL DATA FIELDS:
${fieldLines || "  No additional fields"}

Term ids to extract: offer_price, financing_structure, down_payment, down_payment_pct, loan_amount, interest_rate, loan_term, first_payment_deferral, balloon_prepayment, earnest_money, due_diligence_period, closing_timeline, contingencies, buyer_name_entity, seller_agent_name, seller_agent_email, commission_handling, property_address.`;

  let terms = baseTerms;
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = rawText
      .replace(/^```json?\s*/im, "")
      .replace(/\s*```\s*$/im, "")
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const raw = JSON.parse(jsonMatch[0]) as {
        terms?: Array<{ id: string; value: string | null; value_numeric?: number | null }>;
      };
      const valueMap = new Map((raw.terms ?? []).map((t) => [t.id, t]));
      terms = baseTerms.map((term) => {
        const extracted = valueMap.get(term.id);
        if (!extracted || isMissingValue(extracted.value)) return term;
        return {
          ...term,
          value: extracted.value,
          value_numeric: extracted.value_numeric ?? term.value_numeric,
          confidence: term.confidence === "missing" ? "inferred" : term.confidence,
          source: term.value ? term.source : "Extracted by AI from deal data",
        };
      });
    }
  } catch (e) {
    console.error("[generateLOI] term extraction failed — using base terms:", e);
  }

  // Prose is ALWAYS the locked template — only values differ between versions
  const sections = fillAllSections(terms);
  return { terms, sections };
}
