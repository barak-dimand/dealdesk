"use client";

import { useState, useEffect } from "react";
import { useDealStore } from "@/store/dealStore";
import { formatCentsFull } from "@/lib/utils";
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

export function DealIntelligenceBanner() {
  const { activeDeal, units, dataFields, documents, recommendation, setCenterTab } =
    useDealStore();
  const [collapsed, setCollapsed] = useState(false);
  const [reviewDoc, setReviewDoc] = useState<DealDocument | null>(null);

  const dealId = activeDeal?.id ?? null;
  const storageKey = dealId ? `dealdesk_intel_collapsed_${dealId}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      setCollapsed(localStorage.getItem(storageKey) === "1");
    } catch {
      setCollapsed(false);
    }
  }, [storageKey]);

  const parsedDocs = documents.filter((d) => d.status === "parsed");
  if (!activeDeal || parsedDocs.length === 0) return null;

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // storage blocked
      }
    }
  }

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

  return (
    <div className="flex-shrink-0 border-b border-[#eae6dd] bg-[#faf8f3] px-3.5 py-3">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-bold text-[#23211d]">Deal Intelligence</span>
        {collapsed && (
          <span className="text-[11.5px] text-[#6b6862]">
            {opportunities.length} opportunities · {risks.length} risks · {steps.length}{" "}
            next steps
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand intelligence banner" : "Collapse intelligence banner"}
          className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[#9b978f] hover:bg-[#f4f2eb] hover:text-[#23211d] transition-colors cursor-pointer"
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* Cards */}
      {!collapsed && (
        <div className="flex flex-col md:flex-row gap-3 mt-2.5">
          <Card
            title="Value Add Opportunities"
            icon={<TrendingUp size={13} className="text-[#2f6d4f]" />}
            borderColor="#2f6d4f"
          >
            {opportunities.length === 0 ? (
              <p className="text-[12px] text-[#b3aea3] italic">
                No value-add opportunities detected yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {opportunities.map((o, i) => (
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
            {risks.length === 0 ? (
              <p className="text-[12px] text-[#b3aea3] italic">No risk flags detected.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {risks.map((r, i) => (
                  <li key={i} className="text-[12px] text-[#3a3833] leading-[1.5]">
                    · {r}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Next Steps"
            icon={<ListChecks size={13} className="text-[#2f5d50]" />}
            borderColor="#2f5d50"
          >
            <ul className="flex flex-col gap-1.5">
              {steps.map((step, i) => (
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
                  {step.sublist && (
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
