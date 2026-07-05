import Anthropic from "@anthropic-ai/sdk";
import { calcAnnualPayment } from "@/lib/utils";
import type { DealRecommendation, DealTier, OfferScenario, DealRiskFlag } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface RecommendContext {
  dealName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  assetClass: string;
  askPrice: number; // cents
  unitCount: number;
  dataFields: Array<{
    field_key: string;
    field_value: string | null;
    field_value_numeric: number | null;
  }>;
  units: Array<{
    unit_number: string;
    unit_type: string | null;
    current_rent: number | null; // cents
    market_rent: number | null; // cents
    status: string;
  }>;
}

interface RawScenario {
  id: string;
  label: string;
  tier: string;
  purchase_price_dollars: number;
  down_payment_dollars: number;
  structure_type: string;
  structure_label: string;
  interest_rate: number;
  term_years: number;
  first_payment_deferral_months: number;
  interest_only_period_months: number;
  creative_structure_notes: string;
  reserve_strategy: string | null;
}

function computeMonthlyNOI(grossMonthlyCents: number, unitCount: number): number {
  const vacancy = Math.round(grossMonthlyCents * 0.08);
  const mgmt = Math.round(grossMonthlyCents * 0.08);
  const maintenance = unitCount * 75 * 100;
  const capex = unitCount * 50 * 100;
  return grossMonthlyCents - vacancy - mgmt - maintenance - capex;
}

function computeScenario(
  raw: RawScenario,
  grossMonthlyCents: number,
  stabilizedMonthlyCents: number,
  unitCount: number
): OfferScenario {
  const purchaseCents = Math.round((raw.purchase_price_dollars ?? 0) * 100);
  const downCents = Math.round((raw.down_payment_dollars ?? 0) * 100);
  const financedCents = Math.max(0, purchaseCents - downCents);
  const downPct = purchaseCents > 0 ? Math.round((downCents / purchaseCents) * 1000) / 10 : 0;

  const rate = raw.interest_rate ?? 0;
  const termYears = raw.term_years ?? 30;
  const ioMonths = raw.interest_only_period_months ?? 0;

  let monthlyPaymentCents = 0;
  if (financedCents > 0 && rate > 0) {
    if (ioMonths > 0) {
      // Interest-only payment during IO period
      monthlyPaymentCents = Math.round((financedCents / 100) * (rate / 100 / 12) * 100);
    } else {
      const annualDS = calcAnnualPayment(financedCents / 100, rate, termYears, termYears, "monthly");
      monthlyPaymentCents = Math.round((annualDS / 12) * 100);
    }
  }

  const annualDebtServiceCents = monthlyPaymentCents * 12;
  const vacancyCents = Math.round(grossMonthlyCents * 0.08);
  const mgmtCents = Math.round(grossMonthlyCents * 0.08);
  const maintenanceCents = unitCount * 75 * 100;
  const capexCents = unitCount * 50 * 100;
  const totalExpensesCents = vacancyCents + mgmtCents + maintenanceCents + capexCents;
  const monthlyNOICents = grossMonthlyCents - totalExpensesCents;
  const monthlyCFCents = monthlyNOICents - monthlyPaymentCents;
  const cfPerUnitCents = unitCount > 0 ? Math.round(monthlyCFCents / unitCount) : monthlyCFCents;

  // Total cash needed = down + 2.5% closing costs
  const closingCostsCents = Math.round(purchaseCents * 0.025);
  const totalCashNeededCents = downCents + closingCostsCents;
  const annualCFCents = monthlyCFCents * 12;
  const cashOnCash =
    totalCashNeededCents > 0
      ? Math.round((annualCFCents / totalCashNeededCents) * 1000) / 10
      : 0;

  const deferralMonths = raw.first_payment_deferral_months ?? 0;

  return {
    id: raw.id,
    label: raw.label,
    tier: raw.tier as DealTier,
    purchase_price: purchaseCents,
    down_payment: downCents,
    down_payment_pct: downPct,
    financed_amount: financedCents,
    structure_type: raw.structure_type ?? "seller_finance",
    structure_label: raw.structure_label ?? "",
    interest_rate: rate,
    term_years: termYears,
    monthly_payment: monthlyPaymentCents,
    annual_debt_service: annualDebtServiceCents,
    gross_monthly_income: grossMonthlyCents,
    stabilized_monthly_income: stabilizedMonthlyCents,
    vacancy_allowance: vacancyCents,
    maintenance_reserve: maintenanceCents,
    mgmt_fee: mgmtCents,
    capex_reserve: capexCents,
    total_monthly_expenses: totalExpensesCents,
    monthly_noi: monthlyNOICents,
    monthly_cash_flow: monthlyCFCents,
    cash_flow_per_unit: cfPerUnitCents,
    cash_on_cash_return: cashOnCash,
    total_cash_needed: totalCashNeededCents,
    is_zero_down: downCents === 0,
    creative_structure_notes: raw.creative_structure_notes ?? "",
    reserve_strategy: raw.reserve_strategy ?? null,
    first_payment_deferral_months: deferralMonths,
    interest_only_period_months: ioMonths,
    deferred_amount: Math.round(monthlyPaymentCents * deferralMonths),
  };
}

export async function generateRecommendation(
  ctx: RecommendContext
): Promise<DealRecommendation> {
  const grossMonthlyCents = ctx.units.reduce((s, u) => s + (u.current_rent ?? 0), 0);
  const stabilizedMonthlyCents = ctx.units.reduce((s, u) => s + (u.market_rent ?? 0), 0);
  const grossMonthlyDollars = grossMonthlyCents / 100;
  const askDollars = ctx.askPrice / 100;
  const unitCount = ctx.unitCount || ctx.units.length || 1;

  const vacDollars = grossMonthlyDollars * 0.08;
  const mgmtDollars = grossMonthlyDollars * 0.08;
  const maintDollars = unitCount * 75;
  const capexDollars = unitCount * 50;
  const monthlyNOIDollars = grossMonthlyDollars - vacDollars - mgmtDollars - maintDollars - capexDollars;
  const annualNOIDollars = monthlyNOIDollars * 12;
  const capRateAtAsk = askDollars > 0 ? (annualNOIDollars / askDollars) * 100 : 0;

  const occupied = ctx.units.filter((u) => u.status === "occupied").length;
  const vacant = ctx.units.filter((u) => u.status === "vacant").length;

  const unitLines = ctx.units
    .slice(0, 24)
    .map(
      (u) =>
        `  Unit ${u.unit_number} (${u.unit_type ?? "unit"}): $${(u.current_rent ?? 0) / 100}/mo in-place, $${(u.market_rent ?? 0) / 100}/mo market, ${u.status}`
    )
    .join("\n");

  const fieldLines = ctx.dataFields
    .map(
      (f) =>
        `  ${f.field_key}: ${f.field_value ?? (f.field_value_numeric != null ? String(f.field_value_numeric) : "N/A")}`
    )
    .join("\n");

  const systemPrompt = `You are an expert real estate investment analyst specializing in creative finance and seller financing. Analyze deals and provide specific, actionable offer structures that create win-win scenarios for buyer and seller.

INVESTMENT RULES — NON-NEGOTIABLE:
1. Cash flow from day 1 must be positive after ALL expenses and debt service
2. ALWAYS use these expense assumptions: 8% vacancy, $75/unit/month maintenance, 8% management fee, $50/unit/month CapEx reserve
3. Minimum: $100/unit/month net cash flow after ALL expenses and debt service = "Just Right". Below = Pass
4. Home Run = $200+/unit/month with creative terms minimizing buyer's out-of-pocket capital
5. Always explore seller financing first — then IO periods, deferred first payments, master lease, subject-to
6. Structure deals so the buyer needs as little cash out of pocket as possible (zero-down is the goal)
7. If deal cannot reach $100/unit with ANY creative structure, call it Pass and state exactly what price would work

DEAL TIERS:
- home_run: $200+/unit/month net cash flow, creative structure, zero/minimal down payment
- just_right: $100–200/unit/month, deal sustains itself, good terms
- stretch: $50–100/unit/month — show exactly what price or terms change fixes it
- pass: cannot reach $100/unit with any reasonable structure

Always provide EXACTLY 3 scenarios:
- id "home_run": most creative terms, lowest price/best structure, $200+/unit target
- id "just_right": realistic fair offer that works — this is the recommended starting offer
- id "walk_away": absolute maximum price/worst terms buyer should accept ($100/unit floor)

Return ONLY a single valid JSON object. No markdown, no code fences, no explanation. Schema:
{
  "tier": "home_run|just_right|stretch|pass",
  "verdict": "1–2 sentence plain English verdict on this deal",
  "verdict_detail": "3–5 sentences explaining reasoning: why this tier, what makes it work or not, key leverage points",
  "at_asking_price": {
    "works": true_or_false,
    "why_not": "explanation if false — specific numbers, null if true"
  },
  "scenarios": [
    {
      "id": "home_run",
      "label": "Home Run",
      "tier": "home_run",
      "purchase_price_dollars": NUMBER,
      "down_payment_dollars": NUMBER,
      "structure_type": "seller_finance|cash|subject_to|master_lease|wrap|lease_option|interest_only",
      "structure_label": "e.g. 30-yr seller finance, 5.5%, IO yr 1–3, 3-mo payment deferral",
      "interest_rate": NUMBER,
      "term_years": NUMBER,
      "first_payment_deferral_months": NUMBER,
      "interest_only_period_months": NUMBER,
      "creative_structure_notes": "plain English: why this structure, what the seller gets, how buyer gets zero-down",
      "reserve_strategy": "how buyer builds reserves if cash flow is slim, or null"
    },
    { "id": "just_right", "label": "Just Right", ...same fields... },
    { "id": "walk_away", "label": "Walk Away Number", ...same fields... }
  ],
  "risk_flags": [
    {
      "id": "snake_case_id",
      "severity": "high|medium|low",
      "label": "Short flag title (under 40 chars)",
      "detail": "Specific concern with numbers where possible",
      "mitigation": "Concrete mitigation step, or null"
    }
  ],
  "documents_needed": ["specific document names — T-12, rent roll, leases, tax returns, etc."],
  "appreciation_case": "Specific appreciation upside if any — market trends, rent upside, value-add — or null for pure cash flow deal",
  "market_context": "Relevant local market context affecting the deal, or null"
}`;

  const userPrompt = `DEAL: ${ctx.dealName}
Location: ${[ctx.address, ctx.city, ctx.state].filter(Boolean).join(", ") || "Unknown"}
Asset class: ${ctx.assetClass}
Asking price: $${askDollars.toLocaleString("en-US", { maximumFractionDigits: 0 })}
Units: ${unitCount} (${occupied} occupied, ${vacant} vacant)

INVESTMENT PHILOSOPHY EXPENSE CALCULATION (use these exact numbers):
Gross monthly income (current rents): $${grossMonthlyDollars.toFixed(0)}/mo
  Less vacancy (8%):                 -$${vacDollars.toFixed(0)}/mo
  Less management (8%):              -$${mgmtDollars.toFixed(0)}/mo
  Less maintenance ($75/unit/mo):    -$${maintDollars.toFixed(0)}/mo
  Less CapEx reserve ($50/unit/mo):  -$${capexDollars.toFixed(0)}/mo
Monthly NOI after all operating exp:  $${monthlyNOIDollars.toFixed(0)}/mo ($${annualNOIDollars.toFixed(0)}/yr)
Cap rate at ask (on this NOI):        ${capRateAtAsk.toFixed(2)}%
NOI per unit per month:               $${(monthlyNOIDollars / unitCount).toFixed(0)}/unit/mo

RENT ROLL (${ctx.units.length} units):
${unitLines || "  No unit data provided"}

ADDITIONAL DATA FIELDS:
${fieldLines || "  No additional fields"}

IMPORTANT: Verify your scenarios produce the required cash flow AFTER subtracting monthly debt service from the monthly NOI above. Show the math check in creative_structure_notes.`;

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
    console.error("No JSON in Claude response:", rawText.slice(0, 800));
    throw new Error("No JSON response from AI");
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("JSON parse error:", e, "\nJSON:", jsonMatch[0].slice(0, 800));
    throw new Error("Invalid JSON from AI");
  }

  const rawScenarios = (raw.scenarios as RawScenario[]) ?? [];
  const scenarios: OfferScenario[] = rawScenarios.map((s) =>
    computeScenario(s, grossMonthlyCents, stabilizedMonthlyCents, unitCount)
  );

  // Compute at_asking_price using 0-down 30-yr seller finance at 6.5% (standard benchmark)
  const atAskPaymentCents =
    ctx.askPrice > 0
      ? Math.round(
          (calcAnnualPayment(ctx.askPrice / 100, 6.5, 30, 30, "monthly") / 12) * 100
        )
      : 0;
  const atAskMonthlyCF = computeMonthlyNOI(grossMonthlyCents, unitCount) - atAskPaymentCents;
  const atAskCFPerUnit = unitCount > 0 ? Math.round(atAskMonthlyCF / unitCount) : atAskMonthlyCF;

  const atAskRaw = raw.at_asking_price as
    | { works: boolean; why_not: string | null }
    | undefined;

  const now = new Date().toISOString();
  return {
    id: "",
    deal_id: "",
    tier: (raw.tier as DealTier) ?? "pass",
    verdict: (raw.verdict as string) ?? "",
    verdict_detail: (raw.verdict_detail as string) ?? "",
    at_asking_price: {
      cash_flow_per_unit: atAskCFPerUnit,
      works: atAskRaw?.works ?? atAskCFPerUnit >= 10000,
      why_not: atAskRaw?.why_not ?? null,
    },
    scenarios,
    risk_flags: ((raw.risk_flags as DealRiskFlag[]) ?? []),
    documents_needed: (raw.documents_needed as string[]) ?? [],
    appreciation_case: (raw.appreciation_case as string | null) ?? null,
    market_context: (raw.market_context as string | null) ?? null,
    generated_at: now,
    created_at: now,
  };
}
