import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ParsedDealData {
  units: ParsedUnit[];
  incomeItems: ParsedLineItem[];
  expenseItems: ParsedLineItem[];
  summaryItems: ParsedLineItem[];
  notes: string;
  documentType: string;
  confidence: number;
  warnings: string[];
}

export interface ParsedUnit {
  unit_number: string;
  unit_type: string | null;
  current_rent: number | null; // dollars
  market_rent: number | null;
  status: "occupied" | "vacant" | "leased" | "credit" | "other";
  lease_start: string | null;
  lease_end: string | null;
  tenant_notes: string | null;
  // provenance
  source_text_snippet?: string | null;
  source_type?: "ai_parsed" | "ai_inferred";
  source_confidence?: "high" | "medium" | "low";
}

export interface ParsedLineItem {
  field_key: string;
  field_label: string;
  value_numeric: number | null; // annual dollars
  period: "monthly" | "annual" | "per_unit";
  ai_note: string | null;
  confidence: number;
  // provenance
  source_text_snippet?: string | null;
  source_type?: "ai_parsed" | "ai_inferred";
}

function fileTypeHint(fileType: string): string {
  switch (fileType) {
    case "pdf":
      return "This is likely an Offering Memorandum, P&L statement, or rent roll. Extract all financial data precisely.";
    case "csv":
    case "xlsx":
      return "This is structured tabular data. Treat the first row as column headers. Extract all numeric financial data exactly as shown.";
    case "eml":
    case "pasted_text":
      return "This may be an email, listing description, social media post, or informal notes. Extract whatever deal data exists — asking price, unit count, rents, expenses — even if mentioned casually.";
    case "image":
      return "This is OCR-extracted text from a photo or screenshot. Data may contain OCR errors — use context to correct obvious mistakes (e.g. 'S725' is likely '$725', 'l' may be '1').";
    case "docx":
      return "This is a Word document — likely a lease, letter of intent, property report, or offering summary.";
    default:
      return "";
  }
}

const SYSTEM_PROMPT = `You are a commercial real estate data extraction expert.
Your job is to parse real estate documents (rent rolls, T12s, P&Ls, income statements, seller notes, emails)
and extract structured financial data.

Key rules:
- Always extract rent/income in ANNUAL dollars unless told otherwise (multiply monthly × 12)
- Flag any anomalies or elevated expenses with ai_note
- For rent rolls: extract each unit individually
- For financials: separate income and expenses clearly
- Confidence: 0.0-1.0 based on clarity of source data
- If data is ambiguous, note it in the warnings field
- Repair/maintenance > 15% of income = flag as elevated
- Vacancy > 20% = flag
- For expenses, NEVER include debt service/mortgage as an operating expense

CRITICAL — Unit extraction rule:
ONLY extract units that are EXPLICITLY listed in the source document with their own row or entry (e.g., "Unit 101 — 2BR — $950/mo — Occupied").
Do NOT estimate, reconstruct, or generate unit data from aggregate totals or unit mix summaries.
If the document only shows aggregate/summary data (e.g., "8 one-bedrooms averaging $629/mo"), extract that as a summary data field
(e.g., field_key: "avg_1br_rent", field_label: "Avg 1BR Rent", field_value_string: "$629/mo") and return an EMPTY units array.
It is ALWAYS better to return no units than to return estimated units.
When returning no units due to aggregate-only data, you MUST add this warning:
"No unit-level detail found — only aggregate data available. Upload a detailed rent roll for individual unit data."

Additional unit quality rule:
If you are uncertain about any individual unit's rent, status, or type, EXCLUDE that unit from the units array entirely and add a warning instead.

PROVENANCE — for each value you extract, include the source_text_snippet: copy the
exact text from the document where you found this value (max 200 chars).
If you are inferring or estimating a value rather than reading it directly,
set source_type to 'ai_inferred' and confidence to 'low' or 'medium'.
Only use source_type 'ai_parsed' when the value is explicitly stated.

STANDARDIZED FIELD KEYS — always use these exact field_key values (never variants):
- 'gross_operating_income' (NOT 'annual_gross_income', 'gross_income', or 'total_income')
- 'reported_noi' (NOT 'net_operating_income', 'reported_net_income', or 'noi')
- 'repairs_maintenance' (NOT 'repairs_and_maintenance' or 'maintenance')
- 'cap_rate_at_ask' (NOT 'cap_rate_asking' or 'cap_rate')
- 'total_expenses' (NOT 'total_operating_expenses')
- 'property_management' (NOT 'management_fee' or 'management')
- 'asking_price', 'price_per_unit', 'gross_rent_multiplier', 'vacancy_rate', 'pro_forma_noi'

Respond ONLY with valid JSON matching the ParsedDealData schema.`;

export async function parseDocumentWithAI(
  rawText: string,
  fileName: string,
  fileType: string,
  existingContext?: string
): Promise<ParsedDealData> {
  const hint = fileTypeHint(fileType);

  const prompt = `Parse the following ${fileType.toUpperCase()} document: "${fileName}"
${hint ? `\nDocument type guidance: ${hint}\n` : ""}
${existingContext ? `Existing deal context:\n${existingContext}\n\n` : ""}
Document content:
${rawText}

Extract all financial data and return as JSON with this exact structure:
{
  "documentType": "rent_roll|t12|pl|income_statement|seller_notes|email|comp_report|other",
  "confidence": 0.0-1.0,
  "warnings": ["any data quality issues"],
  "notes": "brief summary of what was found",
  "units": [
    {
      "unit_number": "string",
      "unit_type": "1BR/1BA|2BR/1BA|etc or null",
      "current_rent": dollars_per_month_or_null,
      "market_rent": dollars_per_month_or_null,
      "status": "occupied|vacant|leased|credit|other",
      "lease_start": "YYYY-MM-DD or null",
      "lease_end": "YYYY-MM-DD or null",
      "tenant_notes": "any notes or null",
      "source_text_snippet": "exact text from document where this unit appears (max 200 chars)",
      "source_type": "ai_parsed|ai_inferred",
      "source_confidence": "high|medium|low"
    }
  ],
  "incomeItems": [
    {
      "field_key": "snake_case_key",
      "field_label": "Human readable label",
      "value_numeric": annual_dollars,
      "period": "annual",
      "ai_note": "flag or null",
      "confidence": 0.0-1.0,
      "source_text_snippet": "exact text where this value was found (max 200 chars)",
      "source_type": "ai_parsed|ai_inferred"
    }
  ],
  "expenseItems": [
    {
      "field_key": "snake_case_key",
      "field_label": "Human readable label",
      "value_numeric": annual_dollars,
      "period": "annual",
      "ai_note": "flag if elevated or unusual",
      "confidence": 0.0-1.0,
      "source_text_snippet": "exact text where this value was found (max 200 chars)",
      "source_type": "ai_parsed|ai_inferred"
    }
  ],
  "summaryItems": [
    {
      "field_key": "asking_price|price_per_unit|gross_rent_multiplier|etc",
      "field_label": "Human readable",
      "value_numeric": number_or_null,
      "period": "annual",
      "ai_note": null,
      "confidence": 0.9,
      "source_text_snippet": "exact text where this value was found (max 200 chars)",
      "source_type": "ai_parsed|ai_inferred"
    }
  ]
}

Important:
- Rent roll units: current_rent and market_rent are in DOLLARS PER MONTH
- Income/expense items: value_numeric is in ANNUAL DOLLARS
- If the document has both a rent roll AND financials, extract both
- Do not include debt service or mortgage payments in expenses
- Income should include: rent income, laundry, parking, other income
- Common expenses: repairs/maintenance, taxes, insurance, management, utilities, supplies, legal/accounting`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const parsed = JSON.parse(jsonMatch[0]) as ParsedDealData;
    return parsed;
  } catch (e) {
    console.error("AI parse error:", e);
    return {
      units: [],
      incomeItems: [],
      expenseItems: [],
      summaryItems: [],
      notes: `Failed to parse: ${e instanceof Error ? e.message : String(e)}`,
      documentType: "other",
      confidence: 0,
      warnings: ["AI parsing failed"],
    };
  }
}
