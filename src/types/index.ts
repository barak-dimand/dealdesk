export type DealType =
  | "multifamily"
  | "commercial"
  | "retail"
  | "storage"
  | "industrial"
  | "land"
  | "residential"
  | "mixed_use"
  | "office"
  | "hotel";

export type DealStatus =
  | "evaluating"
  | "off_market"
  | "marketed"
  | "under_loi"
  | "under_contract"
  | "closed"
  | "dead";

export type DocumentStatus = "pending" | "parsing" | "parsed" | "error";

export type DocumentFileType =
  | "pdf"
  | "csv"
  | "xlsx"
  | "txt"
  | "eml"
  | "image"
  | "pasted_text"
  | "docx";

export type OfferStructureType =
  | "seller_finance"
  | "cash"
  | "hard_money"
  | "subject_to"
  | "wrap"
  | "lease_option"
  | "conventional"
  | "bridge";

export interface Workspace {
  id: string;
  name: string;
  owner_clerk_id: string;
  created_at: string;
}

export interface Deal {
  id: string;
  workspace_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  deal_type: DealType;
  status: DealStatus;
  asking_price: number | null; // in cents
  unit_count: number | null;
  sqft: number | null;
  year_built: number | null;
  description: string | null;
  parsed_at: string | null;
  created_at: string;
  updated_at: string;
  loi_state: LOIState;
  loi_sent_at: string | null;
  contact_name: string | null;
  contact_email: string | null;
  // joined
  document_count?: number;
  parsed_document_count?: number;
}

export interface DealDocument {
  id: string;
  deal_id: string;
  name: string;
  file_type: DocumentFileType;
  storage_path: string | null;
  file_size: number | null;
  raw_text: string | null;
  status: DocumentStatus;
  parse_error: string | null;
  parsed_at: string | null;
  created_at: string;
  // parse metadata (populated after first successful parse)
  document_type: string | null;
  parse_confidence: "high" | "medium" | "low" | null;
  parse_warnings: string[] | null;
  extracted_unit_count: number | null;
  extracted_field_count: number | null;
}

export interface DealDataField {
  id: string;
  deal_id: string;
  document_id: string | null;
  category: "income" | "expense" | "summary" | "financing" | "market" | "unit";
  field_key: string;
  field_label: string;
  field_value: string | null;
  field_value_numeric: number | null;
  field_period: "monthly" | "annual" | "per_unit" | null;
  is_verified: boolean;
  ai_confidence: number | null;
  ai_note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DealUnit {
  id: string;
  deal_id: string;
  document_id: string | null;
  unit_number: string;
  unit_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  current_rent: number | null; // cents
  market_rent: number | null; // cents
  status: "occupied" | "vacant" | "leased" | "credit" | "other";
  lease_start: string | null;
  lease_end: string | null;
  tenant_notes: string | null;
  is_verified: boolean;
  sort_order: number;
  created_at: string;
}

export interface DealMessage {
  id: string;
  deal_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  proposal?: ChatProposal;
  loiDraft?: { sections: LOISection[]; terms: LOITerm[] };
}

// ─── Chat Command Center ───

export type AppUpdateType =
  | "loi_draft"        // AI drafted a full LOI in chat
  | "loi_term"         // update a specific LOI term value
  | "data_field"       // update a spreadsheet data field
  | "unit"             // update a unit's rent/status
  | "deal_status"      // update the deal status
  | "notes";           // update notes content

export interface ProposedChange {
  id: string;                   // stable uuid for this change
  type: AppUpdateType;
  label: string;                // human readable e.g. "Reported NOI"
  oldValue: string | null;      // formatted display value
  newValue: string;             // formatted display value
  payload: {
    loiDraft?: { sections: LOISection[]; terms: LOITerm[] };
    /** loi_draft proposals from chat carry term values only; the app fills
     *  the locked template to produce sections */
    loiTerms?: Array<{ id: string; value?: string | null; value_numeric?: number | null }>;
    termId?: string;
    termValue?: string;
    fieldId?: string;
    fieldKey?: string;
    fieldValueNumeric?: number;
    fieldValue?: string;
    unitId?: string;
    unitRent?: number;
    unitStatus?: string;
    dealStatus?: string;
    notesContent?: string;
  };
}

export interface ChatProposal {
  id: string;
  messageId: string;            // the AI message this came from
  dealId: string;
  changes: ProposedChange[];
  status: "pending" | "partially_applied" | "applied" | "rejected";
  appliedChangeIds: string[];   // which individual changes were accepted
  createdAt: string;
}

export interface LOIVersion {
  id: string;
  deal_id: string;
  version_number: number;
  label: string;                // e.g. "v1 · From chat · Jun 29"
  source: "chat" | "ai_generated" | "manual";
  sections: LOISection[];
  terms: LOITerm[];
  loi_state: LOIState;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealNote {
  id: string;
  deal_id: string;
  content: string | null;
  updated_at: string;
}

export interface DealOfferStructure {
  id: string;
  deal_id: string;
  structure_type: OfferStructureType;
  name: string;
  purchase_price: number | null; // cents
  down_payment: number | null;
  financed_amount: number | null;
  interest_rate: number | null; // percentage
  term_years: number | null;
  amortization_years: number | null;
  payment_frequency: "monthly" | "quarterly" | "annual";
  first_payment_defer_months: number;
  balloon_years: number | null;
  has_balloon: boolean;
  prepay_penalty: boolean;
  annual_debt_service: number | null; // cents
  monthly_payment: number | null;
  cash_to_close: number | null;
  projected_noi: number | null;
  net_cash_flow: number | null; // noi - debt service
  dscr: number | null;
  cap_rate: number | null;
  is_recommended: boolean;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  notes: string | null;
  created_at: string;
}

// UI state types
export type LayoutMode = "command" | "focus" | "split";
export type CenterTab = "sheet" | "loi" | "rec" | "notes" | "files";
export type SheetTab = "rentroll" | "income" | "expenses" | "summary";
export type MobileTab = "deals" | "sheet" | "notes" | "loi" | "chat" | "files";

export type LOIState = "none" | "generating" | "draft" | "sent";

export type LOITermConfidence = "verified" | "inferred" | "missing";

export interface LOITerm {
  id: string;
  label: string;
  value: string | null;
  value_numeric: number | null;
  confidence: LOITermConfidence;
  source: string | null;
  is_required: boolean;
  affected_section_ids: string[];
}

export interface LOISection {
  id: string;
  label: string;
  content: string;
  sort_order: number;
}

export interface DealLOI {
  id: string;
  deal_id: string;
  terms: LOITerm[];
  sections: LOISection[];
  generated_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealLOISnapshot {
  id: string;
  deal_id: string;
  loi_id: string;
  version: number;
  terms: LOITerm[];
  sections: LOISection[];
  sent_at: string;
  created_at: string;
}

export type DealTier = "home_run" | "just_right" | "stretch" | "pass";

export interface OfferScenario {
  id: string;
  label: string;
  tier: DealTier;
  purchase_price: number;
  down_payment: number;
  down_payment_pct: number;
  financed_amount: number;
  structure_type: string;
  structure_label: string;
  interest_rate: number;
  term_years: number;
  monthly_payment: number;
  annual_debt_service: number;
  gross_monthly_income: number;
  stabilized_monthly_income: number;
  vacancy_allowance: number;
  maintenance_reserve: number;
  mgmt_fee: number;
  capex_reserve: number;
  total_monthly_expenses: number;
  monthly_noi: number;
  monthly_cash_flow: number;
  cash_flow_per_unit: number;
  cash_on_cash_return: number;
  total_cash_needed: number;
  is_zero_down: boolean;
  creative_structure_notes: string;
  reserve_strategy: string | null;
  first_payment_deferral_months: number;
  interest_only_period_months: number;
  deferred_amount: number;
}

export interface DealRiskFlag {
  id: string;
  severity: "high" | "medium" | "low";
  label: string;
  detail: string;
  mitigation: string | null;
}

export interface DealRecommendation {
  id: string;
  deal_id: string;
  tier: DealTier;
  verdict: string;
  verdict_detail: string;
  at_asking_price: {
    cash_flow_per_unit: number;
    works: boolean;
    why_not: string | null;
  };
  scenarios: OfferScenario[];
  risk_flags: DealRiskFlag[];
  documents_needed: string[];
  appreciation_case: string | null;
  market_context: string | null;
  generated_at: string;
  created_at: string;
}

export interface DealWithMetrics extends Deal {
  display_metric: string;
  is_parsing: boolean;
}

// ─── Platform sections: Portfolio, CRM, Buyers ───

export interface PortfolioAsset {
  id: string;
  workspace_id: string;
  origin_deal_id: string | null;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  asset_class: string;
  status: "active" | "stabilizing" | "refinancing" | "listed" | "sold";
  purchase_price: number | null;
  purchase_date: string | null;
  current_value: number | null;
  unit_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface CRMContact {
  id: string;
  workspace_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  tags: string[];
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Buyer {
  id: string;
  workspace_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  buy_box: {
    markets?: string[];
    asset_classes?: string[];
    min_units?: number;
    max_units?: number;
    min_price?: number;
    max_price?: number;
    min_cap_rate?: number;
    financing_types?: string[];
  };
  notes: string | null;
  deals_sent: number;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}
