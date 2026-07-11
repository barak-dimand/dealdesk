"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useDealStore } from "@/store/dealStore";
import { SpreadsheetEngine } from "./core/SpreadsheetEngine";
import {
  computeMetrics,
  gradeMetric,
  GRADE_POINTS,
  type NormalizedMetrics,
  type Grade,
  type GradedMetricId,
} from "@/lib/metrics/normalize";
import { cn } from "@/lib/utils";
import type { DealDataField } from "@/types";

// ─── formatting (metrics are in display dollars, not cents) ─────────────────

function fmtD(v: number | null): string {
  if (v == null) return "—";
  return `$${Math.round(v).toLocaleString("en-US")}`;
}
function fmtMo(v: number | null): string {
  return v == null ? "—" : `${fmtD(v)}/mo`;
}
function fmtYr(v: number | null): string {
  return v == null ? "—" : `${fmtD(v)}/yr`;
}
function fmtPct(v: number | null): string {
  return v == null ? "—" : `${v.toFixed(1)}%`;
}
function fmtX(v: number | null): string {
  return v == null ? "—" : `${v.toFixed(2)}x`;
}

const GRADE_STYLE: Record<Grade, { bg: string; text: string }> = {
  A: { bg: "#2f6d4f", text: "#fff" },
  B: { bg: "#4a7c5e", text: "#fff" },
  C: { bg: "#9a6b3f", text: "#fff" },
  D: { bg: "#a8473a", text: "#fff" },
  F: { bg: "#7a2a1e", text: "#fff" },
};

const VERDICTS: Record<Grade, string> = {
  A: "Strong deal — metrics across the board",
  B: "Solid deal with manageable risks",
  C: "Workable deal — needs value-add execution",
  D: "Risky deal — requires significant improvement",
  F: "Deal does not meet investment criteria",
};

function GradeChip({ grade }: { grade: Grade | null }) {
  if (!grade) {
    return (
      <span className="inline-flex items-center justify-center min-w-[26px] px-1.5 py-[2px] rounded-[6px] text-[10.5px] font-bold bg-[#f1efe8] text-[#9b978f]">
        N/A
      </span>
    );
  }
  const s = GRADE_STYLE[grade];
  return (
    <span
      className="inline-flex items-center justify-center min-w-[26px] px-1.5 py-[2px] rounded-[6px] text-[10.5px] font-bold"
      style={{ background: s.bg, color: s.text }}
    >
      {grade}
    </span>
  );
}

interface ScoreRow {
  label: string;
  value: string;
  gradeId?: GradedMetricId;
  gradeValue?: number | null;
  threshold?: string;
  valueColorByGrade?: boolean;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="bg-[#f0ede6] px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#3a3833]">
      {label}
    </div>
  );
}

function MetricRow({ row }: { row: ScoreRow }) {
  const grade =
    row.gradeId !== undefined ? gradeMetric(row.gradeId, row.gradeValue ?? null) : undefined;
  const color =
    grade && row.valueColorByGrade !== false ? GRADE_STYLE[grade].bg : "#23211d";
  return (
    <div className="flex items-center gap-3 px-4 py-[9px] border-b border-[#f4f2eb]">
      <span className="text-[12.5px] font-semibold text-[#3a3833] flex-1 min-w-0 truncate">
        {row.label}
      </span>
      {row.threshold && (
        <span className="hidden md:block text-[11px] text-[#b3aea3] flex-shrink-0">
          {row.threshold}
        </span>
      )}
      {row.gradeId !== undefined && (
        <span className="flex-shrink-0 w-[38px] text-right">
          <GradeChip grade={grade ?? null} />
        </span>
      )}
      <span
        className="text-[13px] font-mono font-semibold w-[130px] text-right flex-shrink-0"
        style={{ color: row.value === "—" ? "#b3aea3" : color }}
      >
        {row.value}
      </span>
    </div>
  );
}

// ─── overall grade ───────────────────────────────────────────────────────────

function overallGrade(metrics: NormalizedMetrics): {
  grade: Grade | null;
  score: number;
  graded: number;
  total: number;
} {
  const graded: Array<[GradedMetricId, number | null]> = [
    ["physicalVacancy", metrics.physicalVacancyRate],
    ["rentUpsidePct", metrics.rentUpsidePct],
    ["expenseRatio", metrics.expenseRatio],
    ["rmPerUnit", metrics.rmPerUnit],
    ["rmPctIncome", metrics.rmPctIncome],
    ["capRate", metrics.capRateAtAsk],
    ["capRate", metrics.proFormaCapRate],
    ["grm", metrics.grossRentMultiplier],
    ["dscr", metrics.dscr],
    ["cashFlowPerUnit", metrics.cashFlowPerUnit],
    ["cashOnCash", metrics.cashOnCash],
    ["breakEvenOccupancy", metrics.breakEvenOccupancy],
  ];
  let points = 0;
  let count = 0;
  for (const [id, value] of graded) {
    const g = gradeMetric(id, value);
    if (g != null) {
      points += GRADE_POINTS[g];
      count++;
    }
  }
  if (count === 0) return { grade: null, score: 0, graded: 0, total: graded.length };
  const score = points / count;
  const grade: Grade =
    score >= 3.5 ? "A" : score >= 2.5 ? "B" : score >= 1.5 ? "C" : score >= 0.5 ? "D" : "F";
  return { grade, score, graded: count, total: graded.length };
}

// ─── scorecard view ──────────────────────────────────────────────────────────

function Scorecard({ metrics }: { metrics: NormalizedMetrics }) {
  const { activeDeal } = useDealStore();
  const overall = overallGrade(metrics);

  const keyMetricNulls = [
    metrics.grossOperatingIncome,
    metrics.totalExpenses,
    metrics.reportedNOI,
    metrics.capRateAtAsk,
    metrics.dscr,
    metrics.cashOnCash,
    metrics.expenseRatio,
  ].filter((v) => v == null).length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Overall grade */}
      <div className="flex items-center gap-4 px-5 py-5 border-b border-[#e6e3dc]">
        {overall.grade ? (
          <div
            className="w-[68px] h-[68px] rounded-[16px] flex items-center justify-center text-[34px] font-bold text-white flex-shrink-0"
            style={{ background: GRADE_STYLE[overall.grade].bg }}
            data-testid="overall-grade"
          >
            {overall.grade}
          </div>
        ) : (
          <div
            className="w-[68px] h-[68px] rounded-[16px] flex items-center justify-center text-[20px] font-bold bg-[#f1efe8] text-[#9b978f] flex-shrink-0"
            data-testid="overall-grade"
          >
            N/A
          </div>
        )}
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[15px] font-bold text-[#23211d]">
            {overall.grade ? VERDICTS[overall.grade] : "Not enough data to grade this deal"}
          </span>
          <span className="text-[12px] text-[#9b978f]">
            Score {overall.score.toFixed(2)} / 4.00 · {overall.graded} of {overall.total}{" "}
            metrics graded
          </span>
        </div>
      </div>

      {keyMetricNulls > 3 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#fdf6ec] border-b border-[#d4a85a33] text-[12px] text-[#7a5a3a]">
          ⚠️ Limited data — upload income statement and rent roll for complete analysis
        </div>
      )}

      {/* Section 1 — Deal Overview */}
      <SectionHeader label="Deal Overview" />
      <MetricRow row={{ label: "Property", value: activeDeal?.name ?? "—" }} />
      <MetricRow
        row={{
          label: "Location",
          value:
            [activeDeal?.city, activeDeal?.state].filter(Boolean).join(", ") || "—",
        }}
      />
      <MetricRow row={{ label: "Asset Class", value: activeDeal?.deal_type ?? "—" }} />
      <MetricRow
        row={{
          label: "Unit Count",
          value: `${metrics.unitCount} units · ${metrics.vacantUnits} vacant`,
        }}
      />
      <MetricRow row={{ label: "Asking Price", value: fmtD(metrics.askingPrice) }} />
      <MetricRow row={{ label: "Price Per Unit", value: fmtD(metrics.pricePerUnit) }} />

      {/* Section 2 — Income Quality */}
      <SectionHeader label="Income Quality" />
      <MetricRow row={{ label: "Gross Potential Rent", value: fmtMo(metrics.grossPotentialRent) }} />
      <MetricRow row={{ label: "In-Place Rent", value: fmtMo(metrics.inPlaceRent) }} />
      <MetricRow
        row={{
          label: "Loss to Lease",
          value:
            metrics.lossToLease != null
              ? `${fmtD(metrics.lossToLease)}/mo (${fmtD(metrics.lossToLease * 12)}/yr)`
              : "—",
        }}
      />
      <MetricRow
        row={{
          label: "Physical Vacancy",
          value: fmtPct(metrics.physicalVacancyRate),
          gradeId: "physicalVacancy",
          gradeValue: metrics.physicalVacancyRate,
          threshold: "A <5% · B <8% · C <12% · D <18%",
        }}
      />
      <MetricRow row={{ label: "Effective Gross Income", value: fmtYr(metrics.effectiveGrossIncome) }} />
      <MetricRow
        row={{
          label: "Rent Upside",
          value:
            metrics.rentUpsideMonthly != null
              ? `${fmtD(metrics.rentUpsideMonthly)}/mo (+${fmtPct(metrics.rentUpsidePct)})`
              : "—",
          gradeId: "rentUpsidePct",
          gradeValue: metrics.rentUpsidePct,
          threshold: "A >20% · B >10% · C >5% · D >0%",
        }}
      />

      {/* Section 3 — Expense Quality */}
      <SectionHeader label="Expense Quality" />
      <MetricRow row={{ label: "Total Expenses", value: fmtYr(metrics.totalExpenses) }} />
      <MetricRow
        row={{
          label: "Expense Ratio",
          value: fmtPct(metrics.expenseRatio),
          gradeId: "expenseRatio",
          gradeValue: metrics.expenseRatio,
          threshold: "A <40% · B <50% · C <55% · D <60%",
        }}
      />
      <MetricRow
        row={{
          label: "R&M Per Unit/Yr",
          value: fmtD(metrics.rmPerUnit),
          gradeId: "rmPerUnit",
          gradeValue: metrics.rmPerUnit,
          threshold: "A <$600 · B <$900 · C <$1200 · D <$1500",
        }}
      />
      <MetricRow
        row={{
          label: "R&M % of Income",
          value: fmtPct(metrics.rmPctIncome),
          gradeId: "rmPctIncome",
          gradeValue: metrics.rmPctIncome,
          threshold: "A <8% · B <12% · C <15% · D <20%",
        }}
      />
      <MetricRow
        row={{
          label: "Mgmt Fee %",
          value:
            metrics.managementFee != null && metrics.grossOperatingIncome
              ? fmtPct((metrics.managementFee / metrics.grossOperatingIncome) * 100)
              : "—",
        }}
      />

      {/* Section 4 — NOI & Valuation */}
      <SectionHeader label="NOI & Valuation" />
      <MetricRow row={{ label: "Reported NOI", value: fmtYr(metrics.reportedNOI) }} />
      <MetricRow
        row={{
          label: "Adjusted NOI",
          value: metrics.adjustedNOI != null ? `${fmtYr(metrics.adjustedNOI)} (normalized)` : "—",
        }}
      />
      <MetricRow row={{ label: "Pro-Forma NOI", value: fmtYr(metrics.proFormaNOI) }} />
      <MetricRow
        row={{
          label: "Cap Rate (Reported)",
          value: fmtPct(metrics.capRateAtAsk),
          gradeId: "capRate",
          gradeValue: metrics.capRateAtAsk,
          threshold: "A ≥9% · B ≥7% · C ≥5% · D ≥4%",
        }}
      />
      <MetricRow
        row={{
          label: "Cap Rate (Pro-Forma)",
          value: fmtPct(metrics.proFormaCapRate),
          gradeId: "capRate",
          gradeValue: metrics.proFormaCapRate,
          threshold: "A ≥9% · B ≥7% · C ≥5% · D ≥4%",
        }}
      />
      <MetricRow
        row={{
          label: "GRM",
          value: fmtX(metrics.grossRentMultiplier),
          gradeId: "grm",
          gradeValue: metrics.grossRentMultiplier,
          threshold: "A <8x · B <10x · C <12x · D <15x",
        }}
      />

      {/* Section 5 — Financing & Returns */}
      <SectionHeader label="Financing & Returns" />
      <MetricRow
        row={{ label: "Financing Structure", value: metrics.selectedFinancing.structure ?? "—" }}
      />
      <MetricRow
        row={{
          label: "Down Payment",
          value:
            metrics.selectedFinancing.downPayment != null
              ? `${fmtD(metrics.selectedFinancing.downPayment)}${
                  metrics.askingPrice
                    ? ` (${((metrics.selectedFinancing.downPayment / metrics.askingPrice) * 100).toFixed(0)}%)`
                    : ""
                }`
              : "—",
        }}
      />
      <MetricRow
        row={{ label: "Monthly Debt Service", value: fmtMo(metrics.monthlyDebtService) }}
      />
      <MetricRow
        row={{
          label: "DSCR",
          value: fmtX(metrics.dscr),
          gradeId: "dscr",
          gradeValue: metrics.dscr,
          threshold: "A ≥1.4x · B ≥1.3x · C ≥1.2x · D ≥1.1x",
        }}
      />
      <MetricRow
        row={{
          label: "Monthly Cash Flow",
          value: fmtMo(metrics.monthlyCashFlow),
          gradeId: "cashFlowPerUnit",
          gradeValue: metrics.cashFlowPerUnit,
          threshold: "A ≥$300/u · B ≥$150 · C ≥$100 · D ≥$50",
        }}
      />
      <MetricRow
        row={{
          label: "Cash Flow/Unit",
          value: fmtMo(metrics.cashFlowPerUnit),
          gradeId: "cashFlowPerUnit",
          gradeValue: metrics.cashFlowPerUnit,
          threshold: "A ≥$300 · B ≥$150 · C ≥$100 · D ≥$50",
        }}
      />
      <MetricRow
        row={{
          label: "Cash-on-Cash",
          value: fmtPct(metrics.cashOnCash),
          gradeId: "cashOnCash",
          gradeValue: metrics.cashOnCash,
          threshold: "A ≥15% · B ≥10% · C ≥8% · D ≥6%",
        }}
      />
      <MetricRow
        row={{
          label: "Break-Even Occ.",
          value: fmtPct(metrics.breakEvenOccupancy),
          gradeId: "breakEvenOccupancy",
          gradeValue: metrics.breakEvenOccupancy,
          threshold: "A <65% · B <72% · C <78% · D <85%",
        }}
      />

      {/* Section 6 — Risk Flags */}
      <SectionHeader label="Risk Flags" />
      <RiskFlagRow
        active={metrics.rmRatioFlag}
        hasData={metrics.rmPctIncome != null}
        flaggedText={`R&M at ${fmtPct(metrics.rmPctIncome)} of income — request 3 years of repair invoices`}
        cleanText="R&M within normal range"
      />
      <RiskFlagRow
        active={metrics.expenseRatioFlag}
        hasData={metrics.expenseRatio != null}
        flaggedText={`Expense ratio at ${fmtPct(metrics.expenseRatio)} — verify against T12`}
        cleanText="Expense ratio within normal range"
      />
      <RiskFlagRow
        active={metrics.dscrFlag}
        hasData={metrics.dscr != null}
        flaggedText={`DSCR ${fmtX(metrics.dscr)} below 1.2x — thin debt coverage`}
        cleanText="Debt coverage healthy"
      />
      <RiskFlagRow
        active={metrics.vacancyFlag}
        hasData={metrics.vacancyRate != null}
        flaggedText={`Vacancy at ${fmtPct(metrics.vacancyRate)} — verify make-ready plans`}
        cleanText="Vacancy within normal range"
      />
      <div className="h-6" />
    </div>
  );
}

function RiskFlagRow({
  active,
  hasData,
  flaggedText,
  cleanText,
}: {
  active: boolean;
  hasData: boolean;
  flaggedText: string;
  cleanText: string;
}) {
  if (!hasData) {
    return (
      <div className="flex items-center gap-2 px-4 py-[9px] border-b border-[#f4f2eb] text-[12px] text-[#b3aea3] italic">
        No data to assess
      </div>
    );
  }
  return active ? (
    <div className="flex items-center gap-2 px-4 py-[9px] border-b border-[#f4f2eb] bg-[#f5eaea40] text-[12px] text-[#a8473a]">
      <AlertTriangle size={13} className="flex-shrink-0" />
      {flaggedText}
    </div>
  ) : (
    <div className="flex items-center gap-2 px-4 py-[9px] border-b border-[#f4f2eb] text-[12px] text-[#2f6d4f]">
      <CheckCircle2 size={13} className="flex-shrink-0" />
      {cleanText}
    </div>
  );
}

// ─── full-detail view (all parsed fields in the grid engine) ────────────────

interface DetailRow {
  id: string;
  metric: string;
  value: string;
  note: string;
  source: string;
}

function fieldDisplayValue(f: DealDataField): string {
  if (f.field_value && !/^-?\d+(\.\d+)?$/.test(f.field_value.trim())) return f.field_value;
  if (f.field_value_numeric != null) return String(f.field_value_numeric);
  return f.field_value ?? "—";
}

function DetailGrid() {
  const { activeDeal, dataFields } = useDealStore();
  const rows = useMemo<DetailRow[]>(
    () =>
      dataFields.map((f) => ({
        id: f.id,
        metric: f.field_label,
        value: fieldDisplayValue(f),
        note: f.ai_note ?? "",
        source: f.document_id ? "Parsed from documents" : "User entered",
      })),
    [dataFields]
  );

  const columns = useMemo<ColumnDef<DetailRow, unknown>[]>(
    () => [
      { id: "metric", header: "Metric", accessorKey: "metric", size: 220, meta: { type: "text", editable: false } },
      { id: "value", header: "Value", accessorKey: "value", size: 140, meta: { type: "text", align: "right", editable: false } },
      { id: "note", header: "Note", accessorKey: "note", size: 240, meta: { type: "text", editable: false } },
      { id: "source", header: "Source", accessorKey: "source", size: 160, meta: { type: "status", editable: false } },
    ],
    []
  );

  return (
    <SpreadsheetEngine<DetailRow>
      columns={columns}
      data={rows}
      frozenColumns={1}
      showRowNumbers
      dealId={activeDeal?.id ?? ""}
      tableId="summary-detail"
      dealName={activeDeal?.name}
      emptyState={
        <div className="text-center">
          <p className="text-[14px] font-semibold text-[#23211d] mb-1">No parsed fields yet</p>
          <p className="text-[12.5px] text-[#9b978f]">Upload documents to populate this view.</p>
        </div>
      }
    />
  );
}

// ─── tab root ────────────────────────────────────────────────────────────────

export function SummaryTab() {
  const { activeDeal, units, dataFields, recommendation, offerStructures } =
    useDealStore();
  const [view, setView] = useState<"scorecard" | "detail">("scorecard");

  const metrics = useMemo(
    () =>
      computeMetrics(
        activeDeal ?? {},
        units,
        dataFields,
        recommendation,
        offerStructures
      ),
    [activeDeal, units, dataFields, recommendation, offerStructures]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      {/* View toggle */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[#e6e3dc] flex-shrink-0">
        {(["scorecard", "detail"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "px-3 py-1 rounded-[7px] text-[12px] font-medium cursor-pointer transition-colors",
              view === v
                ? "bg-[#2f5d5014] text-[#2f5d50] font-semibold"
                : "text-[#6b6862] hover:text-[#23211d]"
            )}
          >
            {v === "scorecard" ? "Scorecard" : "Full Detail"}
          </button>
        ))}
        <div className="flex-1" />
        {view === "scorecard" && (
          <span className="text-[11px] text-[#9b978f]">
            Normalized via metric layer · aliases + cents/dollars corrected
          </span>
        )}
      </div>

      {view === "scorecard" ? <Scorecard metrics={metrics} /> : <DetailGrid />}
    </div>
  );
}
