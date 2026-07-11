"use client";

import { useState } from "react";
import { useDealStore } from "@/store/dealStore";
import { cn, formatCentsFull, formatPercent } from "@/lib/utils";
import { computeMetrics } from "@/lib/metrics/normalize";
import {
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  FileText,
} from "lucide-react";
import type { DealTier, OfferScenario, DealRiskFlag } from "@/types";

// ─── tier config ────────────────────────────────────────────────────────────

const TIER: Record<
  DealTier,
  { emoji: string; label: string; bg: string; faint: string; border: string }
> = {
  home_run:  { emoji: "🏆", label: "Home Run",  bg: "#2f6d4f", faint: "#2f6d4f10", border: "#2f6d4f" },
  just_right:{ emoji: "✅", label: "Just Right", bg: "#2f5d50", faint: "#2f5d5010", border: "#2f5d50" },
  stretch:   { emoji: "⚠️", label: "Stretch",    bg: "#9a6b3f", faint: "#9a6b3f10", border: "#9a6b3f" },
  pass:      { emoji: "❌", label: "Pass",        bg: "#a8473a", faint: "#a8473a10", border: "#a8473a" },
};

function TierBadge({ tier, size = "lg" }: { tier: DealTier; size?: "sm" | "lg" }) {
  const t = TIER[tier] ?? TIER.pass;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold text-white rounded-xl flex-shrink-0",
        size === "lg" ? "px-4 py-2 text-[14px]" : "px-2 py-0.5 text-[10.5px]"
      )}
      style={{ background: t.bg }}
    >
      {t.emoji} {t.label}
    </span>
  );
}

function fmtSigned(cents: number): string {
  if (cents === 0) return "$0";
  const sign = cents > 0 ? "+" : "-";
  return `${sign}${formatCentsFull(Math.abs(cents))}`;
}

// ─── scenario card ──────────────────────────────────────────────────────────

function MetricCell({ label, value, accent }: { label: string; value: string; accent?: "green" | "red" | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#9b978f]">
        {label}
      </span>
      <span
        className={cn(
          "text-[13px] font-mono font-semibold",
          accent === "green" ? "text-[#2f6d4f]" : accent === "red" ? "text-[#a8473a]" : "text-[#23211d]"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ScenarioCard({
  scenario,
  askingPrice,
  isRecommended,
  onUseForLOI,
  loiLoading,
}: {
  scenario: OfferScenario;
  askingPrice: number;
  isRecommended: boolean;
  onUseForLOI: () => void;
  loiLoading: boolean;
}) {
  // walk_away scenarios always render as Pass regardless of AI-assigned tier
  const effectiveTier: DealTier = scenario.id === "walk_away" ? "pass" : scenario.tier;
  const t = TIER[effectiveTier] ?? TIER.pass;
  const delta = scenario.purchase_price - askingPrice;
  const cfPositive = scenario.monthly_cash_flow > 0;
  const cfNegative = scenario.monthly_cash_flow < 0;

  return (
    <div
      className="rounded-[12px] border p-4 flex flex-col gap-3"
      style={{ borderColor: t.border, background: t.faint }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <TierBadge tier={effectiveTier} size="sm" />
          <span className="text-[13px] font-semibold text-[#23211d]">{scenario.label}</span>
        </div>
        {isRecommended && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#2f5d50] text-white flex-shrink-0">
            Recommended
          </span>
        )}
      </div>

      {/* Price */}
      <div>
        <div className="text-[24px] font-mono font-semibold tracking-[-0.02em] text-[#23211d]">
          {formatCentsFull(scenario.purchase_price)}
        </div>
        {askingPrice > 0 && (
          <div className="text-[11.5px] text-[#9b978f] mt-0.5">
            {delta === 0
              ? "at asking"
              : `${formatCentsFull(Math.abs(delta))} ${delta < 0 ? "below" : "above"} ask`}
          </div>
        )}
        <div className="text-[11.5px] text-[#6b6862] mt-1 italic">{scenario.structure_label}</div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <MetricCell
          label="Monthly Cash Flow"
          value={fmtSigned(scenario.monthly_cash_flow)}
          accent={cfPositive ? "green" : cfNegative ? "red" : null}
        />
        <MetricCell
          label="Cash-on-Cash"
          value={scenario.cash_on_cash_return === 0 && scenario.is_zero_down ? "∞" : formatPercent(scenario.cash_on_cash_return)}
          accent={scenario.cash_on_cash_return > 0 ? "green" : null}
        />
        <MetricCell
          label="Monthly Payment"
          value={formatCentsFull(scenario.monthly_payment)}
        />
        <MetricCell
          label="Down Payment"
          value={scenario.is_zero_down ? "Zero down" : `${formatCentsFull(scenario.down_payment)} (${scenario.down_payment_pct}%)`}
          accent={scenario.is_zero_down ? "green" : null}
        />
        <MetricCell
          label="Cash Flow / Unit"
          value={`${fmtSigned(scenario.cash_flow_per_unit)}/mo`}
          accent={scenario.cash_flow_per_unit >= 10000 ? "green" : scenario.cash_flow_per_unit < 0 ? "red" : null}
        />
        <MetricCell
          label="Total Cash Needed"
          value={formatCentsFull(scenario.total_cash_needed)}
        />
      </div>

      {/* IO / deferral badges */}
      {(scenario.interest_only_period_months > 0 || scenario.first_payment_deferral_months > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {scenario.interest_only_period_months > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-[#e6e3dc] text-[#6b6862]">
              IO for {scenario.interest_only_period_months}mo
            </span>
          )}
          {scenario.first_payment_deferral_months > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-[#e6e3dc] text-[#6b6862]">
              {scenario.first_payment_deferral_months}mo payment deferral
            </span>
          )}
        </div>
      )}

      {/* Creative notes */}
      {scenario.creative_structure_notes && (
        <p className="text-[11.5px] text-[#9b978f] italic leading-[1.5]">
          {scenario.creative_structure_notes}
        </p>
      )}

      {/* Reserve strategy */}
      {scenario.reserve_strategy && (
        <p className="text-[11px] text-[#9a6b3f] leading-[1.5] border-l-2 border-[#9a6b3f] pl-2.5">
          Reserve strategy: {scenario.reserve_strategy}
        </p>
      )}

      {/* Use for LOI */}
      <button
        onClick={onUseForLOI}
        disabled={loiLoading}
        className={cn(
          "mt-1 w-full py-2 text-[12.5px] font-semibold rounded-[8px] transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5",
          isRecommended
            ? "bg-[#2f5d50] text-white hover:bg-[#274e43]"
            : "border border-[#e6e3dc] text-[#6b6862] hover:bg-[#f4f2eb] hover:text-[#23211d]"
        )}
      >
        {loiLoading && <Loader2 size={13} className="animate-spin flex-shrink-0" />}
        {loiLoading ? "Generating LOI…" : "Use for LOI"}
      </button>
    </div>
  );
}

// ─── cash flow breakdown (waterfall) ────────────────────────────────────────

function WaterfallRow({
  label,
  cents,
  isTotal,
  indent,
}: {
  label: string;
  cents: number;
  isTotal?: boolean;
  indent?: boolean;
}) {
  const positive = cents >= 0;
  return (
    <div
      className={cn(
        "flex items-center justify-between py-1.5",
        isTotal ? "border-t border-[#e6e3dc] mt-1 pt-2.5" : "",
        indent ? "pl-4" : ""
      )}
    >
      <span
        className={cn(
          "text-[12.5px]",
          isTotal ? "font-semibold text-[#23211d]" : "text-[#6b6862]"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[13px]",
          isTotal
            ? positive
              ? "font-bold text-[#2f6d4f]"
              : "font-bold text-[#a8473a]"
            : "text-[#3a3833]"
        )}
      >
        {cents < 0 ? "−" : cents === 0 ? "" : "+"}
        {formatCentsFull(Math.abs(cents))}
      </span>
    </div>
  );
}

function CashFlowBreakdown({ scenario }: { scenario: OfferScenario }) {
  return (
    <div className="bg-[#faf9f6] rounded-[10px] border border-[#e6e3dc] p-4">
      <WaterfallRow label="Gross monthly income" cents={scenario.gross_monthly_income} />
      <WaterfallRow label="Vacancy allowance (8%)" cents={-scenario.vacancy_allowance} indent />
      <WaterfallRow label="Management fee (8%)" cents={-scenario.mgmt_fee} indent />
      <WaterfallRow label={`Maintenance ($75 × ${Math.round(scenario.maintenance_reserve / 7500)} units)`} cents={-scenario.maintenance_reserve} indent />
      <WaterfallRow label={`CapEx reserve ($50 × ${Math.round(scenario.capex_reserve / 5000)} units)`} cents={-scenario.capex_reserve} indent />
      <WaterfallRow label="Net Operating Income" cents={scenario.monthly_noi} isTotal />
      <WaterfallRow label="Monthly debt service" cents={-scenario.monthly_payment} indent />
      <WaterfallRow label="Monthly cash flow" cents={scenario.monthly_cash_flow} isTotal />
      <div className="mt-3 pt-3 border-t border-[#e6e3dc] flex items-center justify-between">
        <span className="text-[11px] text-[#9b978f] uppercase font-semibold tracking-[0.07em]">
          Per unit / month
        </span>
        <span
          className={cn(
            "text-[20px] font-mono font-bold",
            scenario.cash_flow_per_unit >= 10000
              ? "text-[#2f6d4f]"
              : scenario.cash_flow_per_unit >= 0
              ? "text-[#9a6b3f]"
              : "text-[#a8473a]"
          )}
        >
          {fmtSigned(scenario.cash_flow_per_unit)}/unit
        </span>
      </div>
    </div>
  );
}

// ─── risk flags ─────────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<
  DealRiskFlag["severity"],
  { border: string; badge: string; label: string }
> = {
  high:   { border: "#a8473a", badge: "bg-[#f5eaea] text-[#a8473a]", label: "High" },
  medium: { border: "#9a6b3f", badge: "bg-[#f7efe6] text-[#9a6b3f]", label: "Medium" },
  low:    { border: "#2f6d4f", badge: "bg-[#eaf1ec] text-[#2f6d4f]", label: "Low" },
};

function RiskFlag({ flag }: { flag: DealRiskFlag }) {
  const s = SEVERITY_STYLE[flag.severity];
  return (
    <div
      className="rounded-[8px] border-l-[3px] pl-3 pr-3 py-2.5 bg-white border border-l-4 border-[#e6e3dc]"
      style={{ borderLeftColor: s.border }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-[4px]", s.badge)}>
          {s.label}
        </span>
        <span className="text-[12.5px] font-semibold text-[#23211d]">{flag.label}</span>
      </div>
      <p className="text-[12px] text-[#6b6862] leading-[1.5]">{flag.detail}</p>
      {flag.mitigation && (
        <p className="text-[11.5px] text-[#9b978f] italic mt-1 leading-[1.5]">
          Mitigation: {flag.mitigation}
        </p>
      )}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export function OfferRecommendation() {
  const {
    activeDeal,
    recommendation,
    isGeneratingRec,
    dataFields,
    units,
    offerStructures,
    setRecommendation,
    setIsGeneratingRec,
    setActiveDeal,
    setLOI,
    setCenterTab,
  } = useDealStore();

  // Normalized metrics — same source of truth as the Summary scorecard
  const metrics = activeDeal
    ? computeMetrics(activeDeal, units, dataFields, recommendation, offerStructures)
    : null;

  const [breakdownOpen, setBreakdownOpen] = useState(true);
  const [loiLoadingId, setLoiLoadingId] = useState<string | null>(null);
  const [verdictExpanded, setVerdictExpanded] = useState(false);

  const hasData = dataFields.length > 0;
  const hasValidRec =
    !!recommendation &&
    !!recommendation.tier &&
    Array.isArray(recommendation.scenarios) &&
    recommendation.scenarios.length > 0;

  async function handleGenerate() {
    if (!activeDeal) return;
    setIsGeneratingRec(true);
    try {
      const res = await fetch(`/api/deals/${activeDeal.id}/recommend`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendation(data.recommendation);
      }
    } finally {
      setIsGeneratingRec(false);
    }
  }

  async function handleGenerateLOI(scenario: OfferScenario) {
    if (!activeDeal || loiLoadingId !== null) return;
    setLoiLoadingId(scenario.id);
    const buyerEntity = localStorage.getItem("dealdesk_buyer_entity") || null;
    const ddRaw = localStorage.getItem("dealdesk_dd_period");
    const ddPeriod = ddRaw ? parseInt(ddRaw, 10) : null;
    try {
      const res = await fetch(`/api/deals/${activeDeal.id}/loi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: {
            purchase_price: scenario.purchase_price,
            down_payment: scenario.down_payment,
            financed_amount: scenario.financed_amount,
            interest_rate: scenario.interest_rate,
            term_years: scenario.term_years,
            first_payment_defer_months: scenario.first_payment_deferral_months,
            has_balloon: false,
            name: scenario.structure_label,
            structure_type: scenario.structure_type,
          },
          ...(buyerEntity ? { buyer_entity: buyerEntity } : {}),
          ...(ddPeriod && !isNaN(ddPeriod) ? { dd_period: ddPeriod } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.loi) {
          setLOI(data.loi);
          setActiveDeal({ ...activeDeal, loi_state: "draft" });
          setCenterTab("loi");
        }
      }
    } finally {
      setLoiLoadingId(null);
    }
  }

  // ── no deal selected ──
  if (!activeDeal) {
    return (
      <div className="flex items-center justify-center h-full text-[#9b978f] text-[13px] p-8 text-center">
        Select a deal to see the recommendation.
      </div>
    );
  }

  // ── generating ──
  if (isGeneratingRec) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
        <Loader2 size={24} className="animate-spin text-[#2f5d50]" />
        <div className="text-[13.5px] font-semibold text-[#23211d]">Analyzing deal…</div>
        <div className="text-[12px] text-[#9b978f] text-center max-w-[220px]">
          Claude is reviewing the financials and building offer scenarios
        </div>
      </div>
    );
  }

  // ── no recommendation yet ──
  if (!hasValidRec) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-12 h-12 rounded-[14px] bg-[#2f5d5014] flex items-center justify-center">
          <TrendingUp size={22} className="text-[#2f5d50]" />
        </div>
        <div>
          <div className="text-[15px] font-semibold text-[#23211d] mb-1.5">
            AI Recommendation
          </div>
          <div className="text-[13px] text-[#9b978f] leading-[1.5] max-w-[240px]">
            {hasData
              ? "Claude will analyze the deal data and generate creative offer scenarios"
              : "Add deal data first, then generate a recommendation"}
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!hasData}
          className="px-6 py-2.5 text-[13.5px] font-semibold bg-[#2f5d50] text-white rounded-[9px] hover:bg-[#274e43] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Generate Recommendation
        </button>
      </div>
    );
  }

  const rec = recommendation!;
  const t = TIER[rec.tier] ?? TIER.pass;
  const askingPrice = activeDeal.asking_price ?? 0;
  const atAsk = rec.at_asking_price;
  const justRightScenario = rec.scenarios.find((s) => s.id === "just_right") ?? rec.scenarios[0];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white">
      {/* ── Verdict Banner (always visible, not scrolled) ── */}
      <div
        className="flex-shrink-0 px-5 py-4 flex items-start justify-between gap-3"
        style={{ background: t.bg }}
      >
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <TierBadge tier={rec.tier} size="lg" />
            {/* At asking price chip */}
            <span
              className={cn(
                "text-[11.5px] font-semibold px-2.5 py-1 rounded-[8px] flex-shrink-0",
                atAsk.cash_flow_per_unit >= 10000
                  ? "bg-white/20 text-white"
                  : "bg-black/20 text-white"
              )}
            >
              {fmtSigned(atAsk.cash_flow_per_unit)}/unit @ ask
            </span>
            {metrics?.reportedNOI != null && (
              <span className="text-[11.5px] font-semibold px-2.5 py-1 rounded-[8px] flex-shrink-0 bg-white/15 text-white/90">
                NOI ${Math.round(metrics.reportedNOI).toLocaleString("en-US")}/yr
                {metrics.capRateAtAsk != null
                  ? ` · ${metrics.capRateAtAsk.toFixed(1)}% cap`
                  : ""}
              </span>
            )}
          </div>
          <div className="text-[14px] font-semibold text-white leading-[1.4]">
            {rec.verdict}
          </div>
          <div className="text-[12px] text-white/75 leading-[1.5]">
            {(() => {
              const sentences = rec.verdict_detail.split(". ");
              if (verdictExpanded || sentences.length <= 3) {
                return (
                  <>
                    {rec.verdict_detail}
                    {sentences.length > 3 && (
                      <>
                        {" "}
                        <button
                          onClick={() => setVerdictExpanded(false)}
                          className="text-white font-semibold underline cursor-pointer"
                        >
                          Show less
                        </button>
                      </>
                    )}
                  </>
                );
              }
              const collapsed = sentences.slice(0, 3).join(". ") + ".";
              return (
                <>
                  {collapsed}
                  {"... "}
                  <button
                    onClick={() => setVerdictExpanded(true)}
                    className="text-white font-semibold underline cursor-pointer"
                  >
                    Show more
                  </button>
                </>
              );
            })()}
          </div>
        </div>
        {/* Refresh */}
        <button
          onClick={handleGenerate}
          title="Regenerate"
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-[8px] bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 bg-[#f6f5f1]">
        {/* Scenario cards */}
        <div className="flex flex-col gap-3">
          {rec.scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              askingPrice={askingPrice}
              isRecommended={scenario.id === "just_right"}
              onUseForLOI={() => handleGenerateLOI(scenario)}
              loiLoading={loiLoadingId === scenario.id}
            />
          ))}
        </div>

        {/* Cash Flow Breakdown */}
        {justRightScenario && (
          <div>
            <button
              onClick={() => setBreakdownOpen((v) => !v)}
              className="flex items-center gap-2 w-full text-left mb-3 cursor-pointer group"
            >
              <span className="text-[12.5px] font-semibold text-[#23211d]">
                Cash Flow Breakdown
              </span>
              <span className="text-[10.5px] text-[#9b978f]">(Just Right scenario)</span>
              <div className="flex-1" />
              {breakdownOpen ? (
                <ChevronDown size={14} className="text-[#9b978f] group-hover:text-[#23211d] transition-colors" />
              ) : (
                <ChevronRight size={14} className="text-[#9b978f] group-hover:text-[#23211d] transition-colors" />
              )}
            </button>
            {breakdownOpen && <CashFlowBreakdown scenario={justRightScenario} />}
          </div>
        )}

        {/* Risk Flags */}
        {rec.risk_flags.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <AlertTriangle size={13} className="text-[#9a6b3f]" />
              <span className="text-[12.5px] font-semibold text-[#23211d]">Risk Flags</span>
              <span className="text-[11px] text-[#9b978f]">· verify before offering</span>
            </div>
            <div className="flex flex-col gap-2">
              {rec.risk_flags.map((flag) => (
                <RiskFlag key={flag.id} flag={flag} />
              ))}
            </div>
          </div>
        )}

        {/* Appreciation Case */}
        {rec.appreciation_case && (
          <div className="rounded-[10px] bg-white border border-[#e6e3dc] p-4">
            <div className="text-[12px] font-semibold text-[#23211d] mb-2">
              Appreciation Case
            </div>
            <p className="text-[12.5px] text-[#6b6862] italic leading-[1.6]">
              {rec.appreciation_case}
            </p>
          </div>
        )}

        {/* Market Context */}
        {rec.market_context && (
          <div className="rounded-[10px] bg-white border border-[#e6e3dc] p-4">
            <div className="text-[12px] font-semibold text-[#23211d] mb-2">
              Market Context
            </div>
            <p className="text-[12.5px] text-[#6b6862] leading-[1.6]">
              {rec.market_context}
            </p>
          </div>
        )}

        {/* Documents Needed */}
        {rec.documents_needed.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <FileText size={13} className="text-[#9b978f]" />
              <span className="text-[12.5px] font-semibold text-[#23211d]">Documents to Request</span>
            </div>
            <div className="flex flex-col gap-2">
              {rec.documents_needed.map((doc, i) => (
                <div key={i} className="flex items-center gap-2.5 text-[12.5px] text-[#3a3833]">
                  <div className="w-[14px] h-[14px] border-[1.5px] border-[#c9c4ba] rounded-[4px] flex-shrink-0" />
                  {doc}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generate LOI section */}
        <div className="border-t border-[#e6e3dc] pt-4">
          <div className="text-[11.5px] text-[#9b978f] mb-3">
            Generate LOI pre-populated from a scenario:
          </div>
          <div className="flex flex-col gap-2">
            {rec.scenarios.map((scenario) => {
              const isThisLoading = loiLoadingId === scenario.id;
              return (
                <button
                  key={scenario.id}
                  onClick={() => handleGenerateLOI(scenario)}
                  disabled={loiLoadingId !== null}
                  className="flex items-center justify-between px-4 py-2.5 rounded-[8px] border border-[#e6e3dc] bg-white hover:bg-[#f4f2eb] text-[12.5px] text-[#23211d] transition-colors cursor-pointer disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    {isThisLoading && <Loader2 size={13} className="animate-spin text-[#2f5d50] flex-shrink-0" />}
                    Generate LOI from <strong>{scenario.label}</strong>
                  </span>
                  <span className="font-mono text-[#9b978f] text-[12px]">
                    {formatCentsFull(scenario.purchase_price)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
