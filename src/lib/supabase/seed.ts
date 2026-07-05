/**
 * Seed script — Calvert Apartments demo data
 * Run from project root: npx tsx src/lib/supabase/seed.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (auto-loaded from .env.local in the project root)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load .env.local ───────────────────────────────────────────────────────────
try {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch {
  // no .env.local — rely on process.env already set
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function die(label: string, err: unknown): never {
  console.error(`✗  ${label}:`, err);
  process.exit(1);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {

  // ── 1. Workspace ─────────────────────────────────────────────────────────
  const { data: ws, error: wsErr } = await sb
    .from("workspaces")
    .select("id")
    .limit(1)
    .single();
  if (!ws) die("No workspace found — open the app first so it auto-creates one", wsErr);
  const workspaceId = ws.id as string;
  console.log("✓  workspace:", workspaceId);

  // ── 2. Deal — find or create / update ────────────────────────────────────
  const { data: existing } = await sb
    .from("deals")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("name", "Calvert Apartments")
    .maybeSingle();

  const dealCore = {
    // Schema columns on deals: name, city, state, deal_type, status, asking_price, unit_count
    city:          "Sharon",
    state:         "PA",
    deal_type:     "multifamily",
    status:        "off_market",
    asking_price:  112500000,   // $1,125,000 in cents
    unit_count:    18,
  };

  let dealId: string;
  if (existing) {
    const { error } = await sb
      .from("deals")
      .update(dealCore)
      .eq("id", existing.id);
    if (error) die("update deal", error);
    dealId = existing.id;
    console.log("✓  updated existing deal:", dealId);
  } else {
    const { data: created, error } = await sb
      .from("deals")
      .insert({ workspace_id: workspaceId, name: "Calvert Apartments", ...dealCore })
      .select("id")
      .single();
    if (error || !created) die("insert deal", error);
    dealId = created.id;
    console.log("✓  created deal:", dealId);
  }

  // ── 3. Units ─────────────────────────────────────────────────────────────
  // Schema columns on deal_units: deal_id, document_id, unit_number, unit_type,
  // bedrooms, bathrooms, sqft, current_rent, market_rent, status, lease_start,
  // lease_end, tenant_notes, is_verified, sort_order
  const { error: delUnitErr } = await sb
    .from("deal_units")
    .delete()
    .eq("deal_id", dealId);
  if (delUnitErr) die("delete units", delUnitErr);

  const unitRows = [
    // ── Building 470 — 2BR/1BA  |  market rent $825/mo (82500¢) ─────────────
    { unit_number: "470-1",  bedrooms: 2, bathrooms: 1, unit_type: "2BR/1BA", market_rent: 82500, current_rent: 72500, status: "occupied", tenant_notes: null,              sort_order: 1  },
    { unit_number: "470-2",  bedrooms: 2, bathrooms: 1, unit_type: "2BR/1BA", market_rent: 82500, current_rent: 72500, status: "occupied", tenant_notes: null,              sort_order: 2  },
    { unit_number: "470-3",  bedrooms: 2, bathrooms: 1, unit_type: "2BR/1BA", market_rent: 82500, current_rent: 77500, status: "occupied", tenant_notes: null,              sort_order: 3  },
    { unit_number: "470-4",  bedrooms: 2, bathrooms: 1, unit_type: "2BR/1BA", market_rent: 82500, current_rent: 62500, status: "occupied", tenant_notes: null,              sort_order: 4  },
    { unit_number: "470-5",  bedrooms: 2, bathrooms: 1, unit_type: "2BR/1BA", market_rent: 82500, current_rent: 60000, status: "occupied", tenant_notes: null,              sort_order: 5  },
    { unit_number: "470-6",  bedrooms: 2, bathrooms: 1, unit_type: "2BR/1BA", market_rent: 82500, current_rent: null,  status: "vacant",   tenant_notes: "Make-ready",      sort_order: 6  },
    { unit_number: "470-7",  bedrooms: 2, bathrooms: 1, unit_type: "2BR/1BA", market_rent: 82500, current_rent: 60000, status: "occupied", tenant_notes: null,              sort_order: 7  },
    { unit_number: "470-8",  bedrooms: 2, bathrooms: 1, unit_type: "2BR/1BA", market_rent: 82500, current_rent: 60000, status: "occupied", tenant_notes: null,              sort_order: 8  },
    { unit_number: "470-9",  bedrooms: 2, bathrooms: 1, unit_type: "2BR/1BA", market_rent: 82500, current_rent: 60000, status: "occupied", tenant_notes: null,              sort_order: 9  },
    { unit_number: "470-10", bedrooms: 2, bathrooms: 1, unit_type: "2BR/1BA", market_rent: 82500, current_rent: 65000, status: "occupied", tenant_notes: null,              sort_order: 10 },
    // ── Building 490 — 1BR/1BA  |  market rent $700/mo (70000¢) ─────────────
    { unit_number: "490-1",  bedrooms: 1, bathrooms: 1, unit_type: "1BR/1BA", market_rent: 70000, current_rent: 60000, status: "occupied", tenant_notes: null,              sort_order: 11 },
    { unit_number: "490-2",  bedrooms: 1, bathrooms: 1, unit_type: "1BR/1BA", market_rent: 70000, current_rent: 68000, status: "occupied", tenant_notes: null,              sort_order: 12 },
    { unit_number: "490-3",  bedrooms: 1, bathrooms: 1, unit_type: "1BR/1BA", market_rent: 70000, current_rent: 60000, status: "occupied", tenant_notes: null,              sort_order: 13 },
    { unit_number: "490-4",  bedrooms: 1, bathrooms: 1, unit_type: "1BR/1BA", market_rent: 70000, current_rent: 17800, status: "credit",   tenant_notes: "Lawncare credit", sort_order: 14 },
    { unit_number: "490-5",  bedrooms: 1, bathrooms: 1, unit_type: "1BR/1BA", market_rent: 70000, current_rent: 62500, status: "occupied", tenant_notes: null,              sort_order: 15 },
    { unit_number: "490-6",  bedrooms: 1, bathrooms: 1, unit_type: "1BR/1BA", market_rent: 70000, current_rent: null,  status: "leased",   tenant_notes: "$725 signed",     sort_order: 16 },
    { unit_number: "490-7",  bedrooms: 1, bathrooms: 1, unit_type: "1BR/1BA", market_rent: 70000, current_rent: 62500, status: "occupied", tenant_notes: null,              sort_order: 17 },
    { unit_number: "490-8",  bedrooms: 1, bathrooms: 1, unit_type: "1BR/1BA", market_rent: 70000, current_rent: 65000, status: "occupied", tenant_notes: null,              sort_order: 18 },
  ].map((u) => ({ ...u, deal_id: dealId, document_id: null, is_verified: true }));

  const { error: unitErr } = await sb.from("deal_units").insert(unitRows);
  if (unitErr) die("insert units", unitErr);
  console.log(`✓  inserted ${unitRows.length} units`);

  // ── 4. Data fields ───────────────────────────────────────────────────────
  // Schema columns: deal_id, document_id, category, field_key, field_label,
  // field_value, field_value_numeric, field_period, is_verified, ai_confidence,
  // ai_note, sort_order
  //
  // Money values stored in cents (bigint pattern).
  // cap_rate_at_ask / pro_forma_cap_rate / expense_ratio stored as basis points
  // (e.g. 320 = 3.20%) in field_value_numeric; display string in field_value.
  const { error: delFieldErr } = await sb
    .from("deal_data_fields")
    .delete()
    .eq("deal_id", dealId);
  if (delFieldErr) die("delete data fields", delFieldErr);

  const fieldDefs = [
    // Income ─────────────────────────────────────────────────────────────────
    { category: "income",  field_key: "gross_operating_income", field_label: "Gross Operating Income", field_value: "$136,405",   field_value_numeric: 13640500,  field_period: "annual",   ai_note: null, sort_order: 1 },
    { category: "income",  field_key: "monthly_gross_income",   field_label: "Monthly Gross Income",   field_value: "$11,367",    field_value_numeric: 1136700,   field_period: "monthly",  ai_note: null, sort_order: 2 },
    { category: "income",  field_key: "rent_income_annual",     field_label: "Rent Income",            field_value: "$133,013",   field_value_numeric: 13301300,  field_period: "annual",   ai_note: null, sort_order: 3 },
    { category: "income",  field_key: "laundry_income_annual",  field_label: "Laundry Income",         field_value: "$3,352",     field_value_numeric: 335200,    field_period: "annual",   ai_note: null, sort_order: 4 },
    // Expenses ────────────────────────────────────────────────────────────────
    { category: "expense", field_key: "total_expenses_annual",  field_label: "Total Expenses",         field_value: "$100,644",   field_value_numeric: 10064400,  field_period: "annual",   ai_note: null, sort_order: 1 },
    { category: "expense", field_key: "repairs_maintenance",    field_label: "Repairs & Maintenance",  field_value: "$26,247",    field_value_numeric: 2624700,   field_period: "annual",   ai_note: "Seller flagged elevated for 2025 tax write-offs", sort_order: 2 },
    { category: "expense", field_key: "real_estate_tax",        field_label: "Real Estate Tax",        field_value: "$18,043",    field_value_numeric: 1804300,   field_period: "annual",   ai_note: null, sort_order: 3 },
    { category: "expense", field_key: "property_management",    field_label: "Property Management",    field_value: "$13,810",    field_value_numeric: 1381000,   field_period: "annual",   ai_note: null, sort_order: 4 },
    { category: "expense", field_key: "sewer",                  field_label: "Sewer",                  field_value: "$7,920",     field_value_numeric: 792000,    field_period: "annual",   ai_note: null, sort_order: 5 },
    { category: "expense", field_key: "water",                  field_label: "Water",                  field_value: "$6,584",     field_value_numeric: 658400,    field_period: "annual",   ai_note: null, sort_order: 6 },
    { category: "expense", field_key: "gas",                    field_label: "Gas",                    field_value: "$6,564",     field_value_numeric: 656400,    field_period: "annual",   ai_note: null, sort_order: 7 },
    { category: "expense", field_key: "insurance",              field_label: "Insurance",              field_value: "$6,269",     field_value_numeric: 626900,    field_period: "annual",   ai_note: null, sort_order: 8 },
    { category: "expense", field_key: "supplies",               field_label: "Supplies",               field_value: "$5,336",     field_value_numeric: 533600,    field_period: "annual",   ai_note: null, sort_order: 9 },
    { category: "expense", field_key: "electric",               field_label: "Electric",               field_value: "$2,887",     field_value_numeric: 288700,    field_period: "annual",   ai_note: null, sort_order: 10 },
    { category: "expense", field_key: "legal_accounting",       field_label: "Legal & Accounting",     field_value: "$1,903",     field_value_numeric: 190300,    field_period: "annual",   ai_note: null, sort_order: 11 },
    { category: "expense", field_key: "telephone",              field_label: "Telephone",              field_value: "$1,708",     field_value_numeric: 170800,    field_period: "annual",   ai_note: null, sort_order: 12 },
    { category: "expense", field_key: "office",                 field_label: "Office",                 field_value: "$1,690",     field_value_numeric: 169000,    field_period: "annual",   ai_note: null, sort_order: 13 },
    { category: "expense", field_key: "mileage",                field_label: "Mileage",                field_value: "$1,684",     field_value_numeric: 168400,    field_period: "annual",   ai_note: null, sort_order: 14 },
    // Summary ─────────────────────────────────────────────────────────────────
    { category: "summary", field_key: "reported_noi",           field_label: "Reported NOI",           field_value: "$35,761",    field_value_numeric: 3576100,   field_period: "annual",   ai_note: null, sort_order: 1 },
    { category: "summary", field_key: "asking_price",           field_label: "Asking Price",           field_value: "$1,125,000", field_value_numeric: 112500000, field_period: null,        ai_note: null, sort_order: 2 },
    { category: "summary", field_key: "price_per_unit",         field_label: "Price Per Unit",         field_value: "$62,500",    field_value_numeric: 6250000,   field_period: "per_unit", ai_note: null, sort_order: 3 },
    { category: "summary", field_key: "cap_rate_at_ask",        field_label: "Cap Rate at Ask",        field_value: "3.20%",      field_value_numeric: 320,       field_period: null,        ai_note: null, sort_order: 4 },
    { category: "summary", field_key: "pro_forma_noi",          field_label: "Pro Forma NOI",          field_value: "$72,000",    field_value_numeric: 7200000,   field_period: "annual",   ai_note: null, sort_order: 5 },
    { category: "summary", field_key: "pro_forma_cap_rate",     field_label: "Pro Forma Cap Rate",     field_value: "6.40%",      field_value_numeric: 640,       field_period: null,        ai_note: null, sort_order: 6 },
    { category: "summary", field_key: "rent_upside_annual",     field_label: "Rent Upside (Annual)",   field_value: "$24,456",    field_value_numeric: 2445600,   field_period: "annual",   ai_note: null, sort_order: 7 },
    { category: "summary", field_key: "expense_ratio",          field_label: "Expense Ratio",          field_value: "73.80%",     field_value_numeric: 7380,      field_period: null,        ai_note: null, sort_order: 8 },
  ];

  const fieldRows = fieldDefs.map((f) => ({
    ...f,
    deal_id: dealId,
    document_id: null,
    is_verified: true,
    ai_confidence: null,
  }));

  const { error: fieldErr } = await sb.from("deal_data_fields").insert(fieldRows);
  if (fieldErr) die("insert data fields", fieldErr);
  console.log(`✓  inserted ${fieldRows.length} data fields`);

  // ── 5. Offer structure ───────────────────────────────────────────────────
  // Schema has no quarterly_payment column. Mapping:
  //   payment_frequency = "quarterly"
  //   annual_debt_service = 916700¢ * 4 = 3666800¢ ($36,668/yr)
  //   monthly_payment = null (not applicable for quarterly schedule)
  //   notes captures the per-quarter amount for display
  const { error: delOfferErr } = await sb
    .from("deal_offer_structures")
    .delete()
    .eq("deal_id", dealId);
  if (delOfferErr) die("delete offer structures", delOfferErr);

  const { error: offerErr } = await sb.from("deal_offer_structures").insert({
    deal_id:                   dealId,
    structure_type:            "seller_finance",
    name:                      "Seller Financing",
    is_recommended:            true,
    purchase_price:            112500000,
    down_payment:              2500000,          // $25,000
    financed_amount:           110000000,         // $1,100,000
    term_years:                30,
    first_payment_defer_months: 6,
    has_balloon:               false,
    payment_frequency:         "quarterly",
    annual_debt_service:       3666800,           // 916700 * 4
    monthly_payment:           null,
    cash_to_close:             2500000,
    projected_noi:             7200000,
    net_cash_flow:             3533200,           // 7200000 - 3666800
    dscr:                      1.96,              // 7200000 / 3666800
    cap_rate:                  6.40,
    notes:                     "Quarterly payment: $9,167",
  });
  if (offerErr) die("insert offer structure", offerErr);
  console.log("✓  inserted offer structure");

  // ── 6. Chat messages ─────────────────────────────────────────────────────
  // Explicit created_at timestamps guarantee display order in the chat UI.
  const { error: delMsgErr } = await sb
    .from("deal_messages")
    .delete()
    .eq("deal_id", dealId);
  if (delMsgErr) die("delete messages", delMsgErr);

  const now = Date.now();
  const messageRows = [
    {
      deal_id:    dealId,
      role:       "assistant",
      content:    "I've parsed 4 documents for Calvert Apartments — the rent roll, 2025 P&L, your seller notes, and the forwarded email. 18 units across 470 & 490 Ormond. Ask is $1,125,000; reported NOI is $35,761. A few numbers need verification — ask me anything, or I can draft an offer.",
      created_at: new Date(now - 120 * 60 * 1000).toISOString(), // 2h ago
    },
    {
      deal_id:    dealId,
      role:       "user",
      content:    "The cap rate at ask looks really low. What's the real NOI?",
      created_at: new Date(now - 115 * 60 * 1000).toISOString(), // 1h55m ago
    },
    {
      deal_id:    dealId,
      role:       "assistant",
      content:    "At the reported NOI of $35,761, the cap rate at the $1,125,000 ask is just 3.2%. But the seller flagged that 2025 repairs & maintenance ($26,247 — about 19% of income) were intentionally elevated for tax write-offs.\n\nIf R&M normalizes to ~$800/unit and you capture the $24,456 of rent upside, pro-forma NOI is closer to ~$72,000 — roughly a 6.4% cap. I'd make any offer contingent on a T12 and the R&M ledger before trusting that. Want me to compare the seller-finance and cash structures?",
      created_at: new Date(now - 110 * 60 * 1000).toISOString(), // 1h50m ago
    },
  ];

  const { error: msgErr } = await sb.from("deal_messages").insert(messageRows);
  if (msgErr) die("insert messages", msgErr);
  console.log(`✓  inserted ${messageRows.length} chat messages`);

  console.log(`\n✅  Done. Calvert Apartments seeded.`);
  console.log(`   Deal ID: ${dealId}`);
}

main().catch((err) => {
  console.error("✗  Unexpected error:", err);
  process.exit(1);
});
