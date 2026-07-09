"use client";

import { useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useDealStore } from "@/store/dealStore";
import { cn, formatCentsFull } from "@/lib/utils";
import { ChevronDown, ChevronUp, TrendingUp, AlertTriangle, ListChecks } from "lucide-react";
import { ParseReviewModal } from "@/components/files/ParseReviewModal";
import type { DealDocument } from "@/types";

const GENERIC_DOCS = [
  "T-12 trailing twelve months P&L",
  "Current rent roll with lease dates",
  "Copies of all current leases",
  "Most recent tax bills",
  "Insurance declaration page",
];

interface NextStep {
  label: string;
  onClick?: () => void;
  sublist?: string[];
}

const RISK_TRUNCATE_AT = 120;

function RiskItem({ text }: { text: string }) {
  if (text.length <= RISK_TRUNCATE_AT) {
    return <li className="text-[12px] text-[#3a3833] leading-[1.5]">· {text}</li>;
  }
  const truncated = text.slice(0, RISK_TRUNCATE_AT).trimEnd() + "...";
  return (
    <li className="text-[12px] text-[#3a3833] leading-[1.5]">
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className="cursor-default">· {truncated}</span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            sideOffset={4}
            className="bg-[#23211d] text-white text-[11.5px] px-2.5 py-1.5 rounded-[6px] shadow-md max-w-[320px] z-50 leading-[1.5]"
          >
            {text}
            <Tooltip.Arrow className="fill-[#23211d]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </li>
  );
}

function Card({
  title,
  icon,
  borderColor,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  borderColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex-1 min-w-0 bg-white rounded-[10px] border border-[#e6e3dc] border-l-[3px] p-3.5"
      style={{ borderLeftColor: borderColor }}
    >
      <div className="flex items-center gap-1.5 mb-2.5">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#6b6862]">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

export type BannerMode = "collapsed" | "peek" | "expanded";

interface DealIntelligenceBannerProps {
  /** Controlled by the resizable split in SpreadsheetView */
  bannerMode?: BannerMode;
  /** Chevron click — parent animates the pane height */
  onToggle?: () => void;
}

export function DealIntelligenceBanner({
  bannerMode = "expanded",
  onToggle,
}: DealIntelligenceBannerProps) {
  const { activeDeal, units, dataFields, documents, recommendation, setCenterTab } =
    useDealStore();
  const [reviewDoc, setReviewDoc] = useState<DealDocument | null>(null);

  const parsedDocs = documents.filter((d) => d.status === "parsed");
  if (!activeDeal || parsedDocs.length === 0) return null;

  const collapsed = bannerMode === "collapsed";
  const peek = bannerMode === "peek";

  // ── Card 1: Value Add Opportunities ──
  const opportunities: string[] = [];

  const upsideCents = units.reduce(
    (sum, u) =>
      u.current_rent != null && u.market_rent != null && u.current_rent < u.market_rent
        ? sum + (u.market_rent - u.current_rent)
        : sum,
    0
  );
  if (upsideCents > 0) {
    opportunities.push(
      `Rent upside available: +${formatCentsFull(upsideCents)}/mo (+${formatCentsFull(upsideCents * 12)}/yr)`
    );
  }

  const vacantUnits = units.filter((u) => u.status === "vacant");
  if (vacantUnits.length > 0) {
    const addsCents = vacantUnits.reduce((s, u) => s + (u.market_rent ?? 0), 0);
    opportunities.push(
      `${vacantUnits.length} vacant unit${vacantUnits.length === 1 ? "" : "s"} — filling adds ~${formatCentsFull(addsCents)}/mo`
    );
  }

  const belowMarketCount = units.filter(
    (u) =>
      u.current_rent != null &&
      u.market_rent != null &&
      u.current_rent < u.market_rent * 0.9
  ).length;
  if (belowMarketCount > 0) {
    opportunities.push(
      `${belowMarketCount} units >10% below market — lease renewal opportunity`
    );
  }

  // ── Card 2: Risk Flags ──
  const risks: string[] = [];

  const docWarnings = parsedDocs.flatMap((d) => d.parse_warnings ?? []).slice(0, 3);
  risks.push(...docWarnings);

  const rmField = dataFields.find(
    (f) => /repair/i.test(f.field_key) && f.field_value_numeric != null
  );
  const grossField =
    dataFields.find(
      (f) =>
        f.category === "income" &&
        /gross/i.test(f.field_key) &&
        f.field_value_numeric != null
    ) ?? dataFields.find((f) => f.category === "income" && f.field_value_numeric != null);
  if (rmField?.field_value_numeric && grossField?.field_value_numeric) {
    const pct = (rmField.field_value_numeric / grossField.field_value_numeric) * 100;
    if (pct > 15) {
      risks.push(
        `R&M at ${pct.toFixed(1)}% of income — request 3 years of repair invoices`
      );
    }
  }

  for (const u of units.filter((u) => u.status === "credit")) {
    risks.push(
      `Non-standard rent arrangement on unit ${u.unit_number} — verify lease terms`
    );
  }

  if (
    activeDeal.unit_count != null &&
    units.length > 0 &&
    units.length !== activeDeal.unit_count
  ) {
    risks.push("Unit count mismatch — verify total unit count with seller");
  }

  // ── Card 3: Next Steps ──
  const hasValidRec =
    !!recommendation &&
    !!recommendation.tier &&
    Array.isArray(recommendation.scenarios) &&
    recommendation.scenarios.length > 0;

  const steps: NextStep[] = [];
  if (!hasValidRec) {
    steps.push({
      label: "Generate AI recommendation to see offer scenarios →",
      onClick: () => setCenterTab("rec"),
    });
  } else if (activeDeal.loi_state === "none") {
    steps.push({
      label: "Generate LOI from recommended offer →",
      onClick: () => setCenterTab("loi"),
    });
  }
  if (activeDeal.loi_state === "draft") {
    steps.push({
      label: "Fill in Earnest Money and Buyer Entity to complete your LOI →",
      onClick: () => setCenterTab("loi"),
    });
  }
  steps.push({
    label: "Request documents from seller",
    sublist:
      hasValidRec && recommendation!.documents_needed.length > 0
        ? recommendation!.documents_needed
        : GENERIC_DOCS,
  });
  const latestParsed = [...parsedDocs].sort((a, b) =>
    (b.parsed_at ?? "").localeCompare(a.parsed_at ?? "")
  )[0];
  steps.push({
    label: "Review parsed data accuracy →",
    onClick: () => setReviewDoc(latestParsed),
  });

  // Peek mode shows only each card's title + first item
  const visibleOpportunities = peek ? opportunities.slice(0, 1) : opportunities;
  const visibleRisks = peek ? risks.slice(0, 1) : risks;
  const visibleSteps = peek ? steps.slice(0, 1) : steps;

  return (
    <div className="h-full flex flex-col border-b border-[#eae6dd] bg-[#faf8f3] px-3.5 py-3 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[12px] font-bold text-[#23211d]">Deal Intelligence</span>
        {collapsed && (
          <span className="text-[11.5px] text-[#6b6862]">
            {opportunities.length} opportunities · {risks.length} risks · {steps.length}{" "}
            next steps
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand intelligence banner" : "Collapse intelligence banner"}
          className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d] transition-colors cursor-pointer"
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* Cards */}
      {!collapsed && (
        <div
          className={cn(
            "flex flex-col md:flex-row gap-3 mt-2.5 flex-1 min-h-0",
            peek ? "overflow-hidden" : "overflow-y-auto"
          )}
        >
          <Card
            title="Value Add Opportunities"
            icon={<TrendingUp size={13} className="text-[#2f6d4f]" />}
            borderColor="#2f6d4f"
          >
            {visibleOpportunities.length === 0 ? (
              <p className="text-[12px] text-[#b3aea3] italic">
                No value-add opportunities detected yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 overflow-hidden">
                {visibleOpportunities.map((o, i) => (
                  <li key={i} className="text-[12px] text-[#3a3833] leading-[1.5]">
                    · {o}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Risk Flags"
            icon={<AlertTriangle size={13} className="text-[#a8473a]" />}
            borderColor="#a8473a"
          >
            {visibleRisks.length === 0 ? (
              <p className="text-[12px] text-[#b3aea3] italic">No risk flags detected.</p>
            ) : (
              <Tooltip.Provider delayDuration={300}>
                <ul className="flex flex-col gap-1.5 overflow-hidden">
                  {visibleRisks.map((r, i) => (
                    <RiskItem key={i} text={r} />
                  ))}
                </ul>
              </Tooltip.Provider>
            )}
          </Card>

          <Card
            title="Next Steps"
            icon={<ListChecks size={13} className="text-[#2f5d50]" />}
            borderColor="#2f5d50"
          >
            <ul className="flex flex-col gap-1.5 overflow-hidden">
              {visibleSteps.map((step, i) => (
                <li key={i} className="text-[12px] leading-[1.5]">
                  {step.onClick ? (
                    <button
                      onClick={step.onClick}
                      className="text-left text-[#2f5d50] font-medium hover:underline cursor-pointer"
                    >
                      {step.label}
                    </button>
                  ) : (
                    <span className="text-[#3a3833]">{step.label}</span>
                  )}
                  {!peek && step.sublist && (
                    <ul className="mt-1 ml-3 flex flex-col gap-0.5">
                      {step.sublist.map((item, j) => (
                        <li key={j} className="text-[11px] text-[#6b6862]">
                          – {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* Review modal for "Review parsed data accuracy" */}
      {reviewDoc && (
        <ParseReviewModal
          document={reviewDoc}
          dealId={activeDeal.id}
          open={!!reviewDoc}
          onClose={() => setReviewDoc(null)}
        />
      )}
    </div>
  );
}
