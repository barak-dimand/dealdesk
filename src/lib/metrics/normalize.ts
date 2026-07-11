/**
 * Metric normalization layer — the single source of truth for deal metrics.
 *
 * Fixes three data-quality problems in deal_data_fields:
 *  1. cents/dollars inconsistency in field_value_numeric between deals
 *  2. field_key aliasing across parse runs (cap_rate_asking vs cap_rate_at_ask)
 *  3. duplicate fields from repeated parses
 *
 * Money semantics in NormalizedMetrics:
 *  - rent figures from units (GPR, in-place, loss-to-lease, rent upside): DOLLARS/MONTH
 *  - income/expense/NOI/valuation figures: DOLLARS/YEAR
 *  - rates (vacancy, cap, expense ratio, cash-on-cash, break-even): PERCENT (0–100)
 */

// Structural input types so both client components (full store types) and the
// server-side recommendation engine (slim ctx types) can call computeMetrics
export interface MetricFieldInput {
  field_key: string;
  field_value: string | null;
  field_value_numeric: number | null;
  category?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MetricUnitInput {
  current_rent: number | null; // cents
  market_rent: number | null; // cents
  status: string;
}

export interface MetricDealInput {
  asking_price?: number | null; // cents (live schema)
  ask_price?: number | null; // cents (legacy/fixture field name)
  unit_count?: number | null;
}

export interface MetricScenarioInput {
  id: string;
  structure_label?: string;
  monthly_payment?: number; // cents
  annual_debt_service?: number; // cents
  monthly_cash_flow?: number; // cents
  cash_flow_per_unit?: number; // cents
  cash_on_cash_return?: number; // percent
  down_payment?: number; // cents
  financed_amount?: number; // cents
  interest_rate?: number;
  term_years?: number;
  purchase_price?: number; // cents
  total_cash_needed?: number; // cents
}

export interface MetricRecommendationInput {
  scenarios?: MetricScenarioInput[] | null;
}

export interface MetricOfferStructureInput {
  name?: string | null;
  structure_type?: string | null;
  is_recommended?: boolean;
  financed_amount?: number | null; // cents
  interest_rate?: number | null;
  term_years?: number | null;
  monthly_payment?: number | null; // cents
  annual_debt_service?: number | null; // cents
  down_payment?: number | null; // cents
  dscr?: number | null;
  cash_to_close?: number | null; // cents
}

// ─── cents/dollars detection ─────────────────────────────────────────────────

/** Extract the leading numeric amount from a display string like "$136,405/yr" or "3.20%" */
function displayAmount(value: string): number | null {
  const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Detects whether field_value_numeric is stored in cents (×100) or dollars.
 * Cents heuristic: numeric > 100,000 AND display value contains "$" AND
 * numeric/100 matches the dollar amount shown in field_value.
 */
export function detectUnit(field: MetricFieldInput): "cents" | "dollars" {
  const numeric = field.field_value_numeric;
  const display = field.field_value;
  if (numeric == null || !display) return "dollars";

  const shown = displayAmount(display);
  if (shown == null) return "dollars";

  if (display.includes("$") && Math.abs(numeric) > 100000) {
    if (Math.abs(numeric / 100 - shown) < 1) return "cents";
  }
  // Same ×100 drift happens on percent fields (e.g. "3.20%" stored as 320)
  if (display.includes("%") && Math.abs(numeric / 100 - shown) < 0.01 && numeric !== shown) {
    return "cents";
  }
  return "dollars";
}

/** Numeric value normalized to display units (dollars for $, percent for %) */
export function toAnnualDollars(field: MetricFieldInput): number {
  const numeric = field.field_value_numeric ?? 0;
  return detectUnit(field) === "cents" ? numeric / 100 : numeric;
}

// ─── alias resolution ────────────────────────────────────────────────────────

export const METRIC_ALIASES: Record<string, string[]> = {
  gross_operating_income: [
    "annual_gross_income", "gross_income", "goi",
    "effective_gross_income", "egi", "total_income",
    "gross_rental_income", "total_revenue",
  ],
  reported_noi: [
    "net_operating_income", "noi", "reported_net_income",
    "net_income", "annual_noi",
  ],
  pro_forma_noi: [
    "proforma_noi", "projected_noi", "stabilized_noi",
    "pro_forma_net_income",
  ],
  repairs_maintenance: [
    "repairs_and_maintenance", "maintenance", "r_and_m",
    "repair_maintenance", "rm_expense",
  ],
  property_management: [
    "management_fee", "mgmt_fee", "property_mgmt",
    "management_fees", "management",
  ],
  cap_rate_at_ask: [
    "cap_rate_asking", "cap_rate", "capitalization_rate",
    "cap_rate_current",
  ],
  pro_forma_cap_rate: [
    "proforma_cap_rate", "projected_cap_rate",
    "stabilized_cap_rate", "pro_forma_cap",
  ],
  price_per_unit: [
    "cost_per_unit", "price_unit", "purchase_price_per_unit",
  ],
  gross_rent_multiplier: [
    "grm", "gross_rent_mult", "rent_multiplier",
  ],
  asking_price: [
    "purchase_price", "list_price", "sale_price",
    "asking_price_total",
  ],
  total_expenses: [
    "total_operating_expenses", "operating_expenses",
    "annual_expenses", "total_expense", "total_expenses_annual",
  ],
  vacancy_rate: [
    "vacancy", "vacancy_loss", "vacancy_percent",
    "economic_vacancy",
  ],
  real_estate_taxes: [
    "real_estate_tax", "property_taxes", "property_tax", "taxes",
  ],
  insurance: ["insurance_expense", "property_insurance"],
  other_income: [
    "laundry_income_annual", "annual_laundry_income", "laundry_income",
    "parking_income", "misc_income", "other_income_annual",
  ],
  annual_debt_service: ["debt_service", "debt_service_annual"],
};

/** Reverse lookup: alias → canonical key (canonical keys map to themselves) */
const ALIAS_TO_CANONICAL = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(METRIC_ALIASES)) {
  ALIAS_TO_CANONICAL.set(canonical, canonical);
  for (const alias of aliases) ALIAS_TO_CANONICAL.set(alias, canonical);
}

export function canonicalKey(fieldKey: string): string {
  return ALIAS_TO_CANONICAL.get(fieldKey) ?? fieldKey;
}

export function resolveField(
  fields: MetricFieldInput[],
  canonical: string
): number | null {
  const exact = fields.find((f) => f.field_key === canonical);
  if (exact && exact.field_value_numeric != null) return toAnnualDollars(exact);

  const aliases = METRIC_ALIASES[canonical] ?? [];
  for (const alias of aliases) {
    const match = fields.find((f) => f.field_key === alias);
    if (match && match.field_value_numeric != null) return toAnnualDollars(match);
  }
  return null;
}

// ─── deduplication ───────────────────────────────────────────────────────────

export function dedupeFields<T extends MetricFieldInput>(fields: T[]): T[] {
  const byCanonical = new Map<string, T>();
  for (const field of fields) {
    const key = canonicalKey(field.field_key);
    const existing = byCanonical.get(key);
    if (!existing) {
      byCanonical.set(key, field);
      continue;
    }
    const a = field.updated_at ?? field.created_at ?? "";
    const b = existing.updated_at ?? existing.created_at ?? "";
    if (a >= b) byCanonical.set(key, field);
  }
  return Array.from(byCanonical.values());
}

// ─── grading ─────────────────────────────────────────────────────────────────

export type Grade = "A" | "B" | "C" | "D" | "F";

export type GradedMetricId =
  | "physicalVacancy"
  | "rentUpsidePct"
  | "expenseRatio"
  | "rmPerUnit"
  | "rmPctIncome"
  | "capRate"
  | "grm"
  | "dscr"
  | "cashFlowPerUnit"
  | "cashOnCash"
  | "breakEvenOccupancy";

// [A, B, C, D] cutoffs; direction 'higher' = value must be >= cutoff,
// 'lower' = value must be < cutoff
const GRADE_BANDS: Record<GradedMetricId, { dir: "higher" | "lower"; cuts: [number, number, number, number] }> = {
  physicalVacancy: { dir: "lower", cuts: [5, 8, 12, 18] },
  rentUpsidePct: { dir: "higher", cuts: [20, 10, 5, 0.0001] },
  expenseRatio: { dir: "lower", cuts: [40, 50, 55, 60] },
  rmPerUnit: { dir: "lower", cuts: [600, 900, 1200, 1500] },
  rmPctIncome: { dir: "lower", cuts: [8, 12, 15, 20] },
  capRate: { dir: "higher", cuts: [9, 7, 5, 4] },
  grm: { dir: "lower", cuts: [8, 10, 12, 15] },
  dscr: { dir: "higher", cuts: [1.4, 1.3, 1.2, 1.1] },
  cashFlowPerUnit: { dir: "higher", cuts: [300, 150, 100, 50] },
  cashOnCash: { dir: "higher", cuts: [15, 10, 8, 6] },
  breakEvenOccupancy: { dir: "lower", cuts: [65, 72, 78, 85] },
};

export function gradeMetric(id: GradedMetricId, value: number | null): Grade | null {
  if (value == null || !Number.isFinite(value)) return null;
  const { dir, cuts } = GRADE_BANDS[id];
  const grades: Grade[] = ["A", "B", "C", "D"];
  for (let i = 0; i < cuts.length; i++) {
    if (dir === "higher" ? value >= cuts[i] : value < cuts[i]) return grades[i];
  }
  return "F";
}

export const GRADE_POINTS: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

// ─── core metrics ────────────────────────────────────────────────────────────

export interface NormalizedMetrics {
  // Income (monthly dollars for rent-roll figures, annual for statements)
  grossPotentialRent: number | null;
  inPlaceRent: number | null;
  lossToLease: number | null;
  /** Σ max(0, market − current) across rented units — the banner/upside figure */
  rentUpsideMonthly: number | null;
  rentUpsidePct: number | null;
  otherIncome: number | null;
  grossOperatingIncome: number | null;
  vacancyRate: number | null;
  vacancyDollars: number | null;
  effectiveGrossIncome: number | null;

  // Expenses (annual dollars)
  totalExpenses: number | null;
  expenseRatio: number | null;
  repairsMaintenance: number | null;
  rmPerUnit: number | null;
  rmPctIncome: number | null;
  propertyManagement: number | null;
  realEstateTaxes: number | null;
  insurance: number | null;
  capexReserve: number | null;
  managementFee: number | null;

  // NOI (annual dollars)
  reportedNOI: number | null;
  adjustedNOI: number | null;
  proFormaNOI: number | null;

  // Valuation
  askingPrice: number | null;
  pricePerUnit: number | null;
  grossRentMultiplier: number | null;
  capRateAtAsk: number | null;
  proFormaCapRate: number | null;
  impliedValue: number | null;

  // Financing (from recommended structure / just_right scenario)
  selectedFinancing: {
    structure: string | null;
    loanAmount: number | null;
    interestRate: number | null;
    termYears: number | null;
    monthlyPayment: number | null;
    annualDebtService: number | null;
    downPayment: number | null;
  };

  // Returns
  monthlyNOI: number | null;
  monthlyDebtService: number | null;
  monthlyCashFlow: number | null;
  cashFlowPerUnit: number | null;
  dscr: number | null;
  cashOnCash: number | null;
  breakEvenOccupancy: number | null;

  // Risk indicators
  rmRatioFlag: boolean;
  expenseRatioFlag: boolean;
  dscrFlag: boolean;
  vacancyFlag: boolean;
  unitCount: number;
  vacantUnits: number;
  physicalVacancyRate: number | null;
}

const MAINT_PER_UNIT_MONTH = 75;
const CAPEX_PER_UNIT_MONTH = 50;
const MGMT_PCT = 0.08;

export function computeMetrics(
  deal: MetricDealInput,
  units: MetricUnitInput[],
  dataFields: MetricFieldInput[],
  recommendation: MetricRecommendationInput | null,
  offerStructures: MetricOfferStructureInput[]
): NormalizedMetrics {
  const fields = dedupeFields(dataFields);
  const get = (key: string) => resolveField(fields, key);

  const unitCount = deal.unit_count ?? units.length;
  const vacantUnits = units.filter((u) => u.status === "vacant").length;
  const physicalVacancyRate =
    units.length > 0 ? (vacantUnits / units.length) * 100 : null;

  // ── income from units (cents → dollars/month) ──
  // GPR: market rent per unit, falling back to current rent when no market
  // estimate exists (real rent rolls often only carry market rent on vacant
  // units — summing market_rent alone would massively understate GPR)
  const gprCents = units.reduce(
    (s, u) => s + (u.market_rent ?? u.current_rent ?? 0),
    0
  );
  const grossPotentialRent = units.length > 0 && gprCents > 0 ? gprCents / 100 : null;

  const inPlaceCents = units
    .filter((u) => u.status === "occupied" || u.status === "leased" || u.status === "credit")
    .reduce((s, u) => s + (u.current_rent ?? 0), 0);
  const inPlaceRent = units.length > 0 && inPlaceCents > 0 ? inPlaceCents / 100 : null;

  const lossToLease =
    grossPotentialRent != null && inPlaceRent != null
      ? grossPotentialRent - inPlaceRent
      : null;

  const upsideCents = units.reduce((s, u) => {
    if (u.current_rent != null && u.market_rent != null && u.current_rent < u.market_rent) {
      return s + (u.market_rent - u.current_rent);
    }
    return s;
  }, 0);
  const rentUpsideMonthly = units.length > 0 ? upsideCents / 100 : null;
  const rentUpsidePct =
    rentUpsideMonthly != null && inPlaceRent != null && inPlaceRent > 0
      ? (rentUpsideMonthly / inPlaceRent) * 100
      : null;

  // ── parsed income/expenses (annual dollars, alias + unit normalized) ──
  const otherIncome = get("other_income");
  const grossOperatingIncome =
    get("gross_operating_income") ??
    (inPlaceRent != null ? inPlaceRent * 12 + (otherIncome ?? 0) : null);

  const vacancyRate = get("vacancy_rate") ?? physicalVacancyRate;
  const vacancyDollars =
    grossOperatingIncome != null && vacancyRate != null
      ? grossOperatingIncome * (vacancyRate / 100)
      : null;
  const effectiveGrossIncome =
    grossOperatingIncome != null
      ? grossOperatingIncome - (vacancyDollars ?? 0)
      : null;

  const repairsMaintenance = get("repairs_maintenance");
  const propertyManagement = get("property_management");
  const realEstateTaxes = get("real_estate_taxes");
  const insurance = get("insurance");
  const capexParsed = get("capex_reserve");

  const expenseLineSum = fields
    .filter((f) => f.category === "expense" && !canonicalKey(f.field_key).includes("total"))
    .reduce((s, f) => s + toAnnualDollars(f), 0);
  const totalExpenses =
    get("total_expenses") ?? (expenseLineSum > 0 ? expenseLineSum : null);

  const expenseRatio =
    totalExpenses != null && effectiveGrossIncome != null && effectiveGrossIncome > 0
      ? (totalExpenses / effectiveGrossIncome) * 100
      : null;

  const rmPerUnit =
    repairsMaintenance != null && unitCount > 0 ? repairsMaintenance / unitCount : null;
  const rmPctIncome =
    repairsMaintenance != null && grossOperatingIncome != null && grossOperatingIncome > 0
      ? (repairsMaintenance / grossOperatingIncome) * 100
      : null;

  const capexReserve =
    capexParsed ?? (unitCount > 0 ? CAPEX_PER_UNIT_MONTH * 12 * unitCount : null);

  // ── NOI ──
  const reportedNOI =
    get("reported_noi") ??
    (grossOperatingIncome != null && totalExpenses != null
      ? grossOperatingIncome - totalExpenses
      : null);

  // Adjusted NOI: EGI − expenses, with reserve/management normalization when unparsed
  let adjustedNOI: number | null = null;
  if (effectiveGrossIncome != null && totalExpenses != null) {
    let normalizedExpenses = totalExpenses;
    if (repairsMaintenance == null && unitCount > 0) {
      normalizedExpenses += MAINT_PER_UNIT_MONTH * 12 * unitCount;
    }
    if (propertyManagement == null && grossOperatingIncome != null) {
      normalizedExpenses += grossOperatingIncome * MGMT_PCT;
    }
    if (capexParsed == null && unitCount > 0) {
      normalizedExpenses += CAPEX_PER_UNIT_MONTH * 12 * unitCount;
    }
    adjustedNOI = effectiveGrossIncome - normalizedExpenses;
  }

  const proFormaNOI = get("pro_forma_noi");

  // ── valuation ──
  const dealAskCents = deal.asking_price ?? deal.ask_price ?? null;
  const askingPrice =
    get("asking_price") ?? (dealAskCents != null ? dealAskCents / 100 : null);
  const pricePerUnit =
    get("price_per_unit") ??
    (askingPrice != null && unitCount > 0 ? askingPrice / unitCount : null);
  const grossRentMultiplier =
    get("gross_rent_multiplier") ??
    (askingPrice != null && grossOperatingIncome != null && grossOperatingIncome > 0
      ? askingPrice / grossOperatingIncome
      : null);
  const capRateAtAsk =
    get("cap_rate_at_ask") ??
    (reportedNOI != null && askingPrice != null && askingPrice > 0
      ? (reportedNOI / askingPrice) * 100
      : null);
  const proFormaCapRate =
    get("pro_forma_cap_rate") ??
    (proFormaNOI != null && askingPrice != null && askingPrice > 0
      ? (proFormaNOI / askingPrice) * 100
      : null);
  const impliedValue = null; // needs a market cap rate input (not captured yet)

  // ── financing: recommended structure, else just_right scenario ──
  const recommended =
    offerStructures.find((o) => o.is_recommended) ?? null;
  const justRight =
    recommendation?.scenarios?.find((s) => s.id === "just_right") ??
    recommendation?.scenarios?.[0] ??
    null;

  const cents = (v: number | null | undefined) => (v != null ? v / 100 : null);

  const selectedFinancing = recommended
    ? {
        structure: recommended.name ?? recommended.structure_type ?? null,
        loanAmount: cents(recommended.financed_amount),
        interestRate: recommended.interest_rate ?? null,
        termYears: recommended.term_years ?? null,
        monthlyPayment: cents(recommended.monthly_payment),
        annualDebtService:
          cents(recommended.annual_debt_service) ??
          (recommended.monthly_payment != null ? (recommended.monthly_payment * 12) / 100 : null),
        downPayment: cents(recommended.down_payment),
      }
    : justRight
      ? {
          structure: justRight.structure_label ?? null,
          loanAmount: cents(justRight.financed_amount),
          interestRate: justRight.interest_rate ?? null,
          termYears: justRight.term_years ?? null,
          monthlyPayment: cents(justRight.monthly_payment),
          annualDebtService:
            cents(justRight.annual_debt_service) ??
            (justRight.monthly_payment != null ? (justRight.monthly_payment * 12) / 100 : null),
          downPayment: cents(justRight.down_payment),
        }
      : {
          structure: null,
          loanAmount: get("seller_finance_balance"),
          interestRate: null,
          termYears: null,
          monthlyPayment: null,
          annualDebtService: get("annual_debt_service"),
          downPayment: get("seller_finance_deposit"),
        };

  // ── returns ──
  const noiForReturns = adjustedNOI ?? reportedNOI;
  const monthlyNOI = noiForReturns != null ? noiForReturns / 12 : null;
  const monthlyDebtService =
    selectedFinancing.monthlyPayment ??
    (selectedFinancing.annualDebtService != null
      ? selectedFinancing.annualDebtService / 12
      : null);
  const monthlyCashFlow =
    cents(justRight?.monthly_cash_flow) ??
    (monthlyNOI != null && monthlyDebtService != null
      ? monthlyNOI - monthlyDebtService
      : null);
  const cashFlowPerUnit =
    cents(justRight?.cash_flow_per_unit) ??
    (monthlyCashFlow != null && unitCount > 0 ? monthlyCashFlow / unitCount : null);
  const dscr =
    recommended?.dscr ??
    (noiForReturns != null &&
    selectedFinancing.annualDebtService != null &&
    selectedFinancing.annualDebtService > 0
      ? noiForReturns / selectedFinancing.annualDebtService
      : null);
  const cashOnCash = justRight?.cash_on_cash_return ?? null;
  const breakEvenOccupancy =
    totalExpenses != null &&
    selectedFinancing.annualDebtService != null &&
    grossPotentialRent != null &&
    grossPotentialRent > 0
      ? ((totalExpenses + selectedFinancing.annualDebtService) /
          (grossPotentialRent * 12)) *
        100
      : null;

  return {
    grossPotentialRent,
    inPlaceRent,
    lossToLease,
    rentUpsideMonthly,
    rentUpsidePct,
    otherIncome,
    grossOperatingIncome,
    vacancyRate,
    vacancyDollars,
    effectiveGrossIncome,
    totalExpenses,
    expenseRatio,
    repairsMaintenance,
    rmPerUnit,
    rmPctIncome,
    propertyManagement,
    realEstateTaxes,
    insurance,
    capexReserve,
    managementFee: propertyManagement,
    reportedNOI,
    adjustedNOI,
    proFormaNOI,
    askingPrice,
    pricePerUnit,
    grossRentMultiplier,
    capRateAtAsk,
    proFormaCapRate,
    impliedValue,
    selectedFinancing,
    monthlyNOI,
    monthlyDebtService,
    monthlyCashFlow,
    cashFlowPerUnit,
    dscr,
    cashOnCash,
    breakEvenOccupancy,
    rmRatioFlag: rmPctIncome != null && rmPctIncome > 15,
    expenseRatioFlag: expenseRatio != null && expenseRatio > 55,
    dscrFlag: dscr != null && dscr < 1.2,
    vacancyFlag: vacancyRate != null && vacancyRate > 15,
    unitCount,
    vacantUnits,
    physicalVacancyRate,
  };
}
