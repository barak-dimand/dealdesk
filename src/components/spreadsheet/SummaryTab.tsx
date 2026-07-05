"use client";

import { useDealStore } from "@/store/dealStore";
import {
  cn,
  formatCentsFull,
  formatPercent,
  formatDSCR,
} from "@/lib/utils";
import { AlertCircle, CheckCircle2, TrendingUp } from "lucide-react";
import type { DealOfferStructure } from "@/types";

function KeyMetricBar({
  label,
  value,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "amber" | "default";
  highlight?: boolean;
}) {
  const toneClass = {
    positive: "text-[#2f6d4f]",
    negative: "text-[#a8473a]",
    amber: "text-[#9a6b3f]",
    default: "text-[#23211d]",
  }[tone ?? "default"];

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-[13px] py-[10px] border-b border-[#efece4]",
        highlight && "bg-[#2f5d5008]"
      )}
    >
      <span className="text-[13px] text-[#3a3833]">{label}</span>
      <span className={cn("text-[13px] font-mono font-semibold", toneClass)}>
        {value}
      </span>
    </div>
  );
}

function DebtServiceBlock({ offer }: { offer: DealOfferStructure }) {
  const annualDS = offer.annual_debt_service ?? 0;
  const monthlyDS = offer.monthly_payment ?? annualDS / 12;
  const cashToClose = offer.cash_to_close ?? 0;
  const noi = offer.projected_noi ?? 0;
  const ncf = offer.net_cash_flow ?? noi - annualDS;
  const dscr = offer.dscr;

  const ncfTone =
    ncf > 0 ? "positive" : ncf < 0 ? "negative" : "default";
  const dscrTone =
    dscr == null ? "default" : dscr >= 1.2 ? "positive" : dscr >= 1.0 ? "amber" : "negative";

  return (
    <div className="border border-[#2f5d5033] bg-[#2f5d500a] rounded-[10px] overflow-hidden">
      <div className="flex items-center gap-2 px-[13px] py-[9px] border-b border-[#2f5d5020]">
        <TrendingUp size={14} className="text-[#2f5d50]" />
        <span className="text-[12px] font-semibold text-[#2f5d50]">
          {offer.name} — Key Returns
        </span>
        {offer.is_recommended && (
          <span className="ml-auto text-[10px] font-semibold bg-[#2f5d50] text-white px-2 py-[2px] rounded-[4px]">
            Recommended
          </span>
        )}
      </div>

      {/* The 3 headline numbers — always prominent */}
      <div className="grid grid-cols-3 divide-x divide-[#2f5d5020]">
        <div className="flex flex-col items-center justify-center p-4 text-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#2f5d50]/60 mb-1">
            Annual Debt Service
          </span>
          <span className="text-[22px] font-semibold font-mono text-[#23211d] tracking-[-0.02em]">
            {formatCentsFull(annualDS)}
          </span>
          <span className="text-[11px] text-[#9b978f] mt-0.5">
            {formatCentsFull(monthlyDS)}/mo ·{" "}
            {offer.payment_frequency}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center p-4 text-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#2f5d50]/60 mb-1">
            Cash to Close
          </span>
          <span
            className={cn(
              "text-[22px] font-semibold font-mono tracking-[-0.02em]",
              cashToClose === 0
                ? "text-[#2f6d4f]"
                : cashToClose < 5000000
                ? "text-[#2f6d4f]"
                : "text-[#23211d]"
            )}
          >
            {formatCentsFull(cashToClose)}
          </span>
          <span className="text-[11px] text-[#9b978f] mt-0.5">
            {offer.down_payment
              ? `$${((offer.down_payment ?? 0) / 100).toLocaleString()} down`
              : "No down payment"}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center p-4 text-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#2f5d50]/60 mb-1">
            Net Cash Flow
          </span>
          <span
            className={cn(
              "text-[22px] font-semibold font-mono tracking-[-0.02em]",
              ncf > 0
                ? "text-[#2f6d4f]"
                : ncf < 0
                ? "text-[#a8473a]"
                : "text-[#9a6b3f]"
            )}
          >
            {ncf > 0 ? "+" : ""}
            {formatCentsFull(ncf)}
            /yr
          </span>
          <span className="text-[11px] text-[#9b978f] mt-0.5">
            DSCR: {formatDSCR(dscr)}
          </span>
        </div>
      </div>

      {/* Additional details */}
      <div className="border-t border-[#2f5d5020] grid grid-cols-2 divide-x divide-[#2f5d5020] text-[12px]">
        <div className="px-4 py-3 flex justify-between">
          <span className="text-[#9b978f]">Purchase price</span>
          <span className="font-mono text-[#23211d]">
            {formatCentsFull(offer.purchase_price ?? 0)}
          </span>
        </div>
        <div className="px-4 py-3 flex justify-between">
          <span className="text-[#9b978f]">Structure</span>
          <span className="font-mono text-[#23211d] capitalize">
            {offer.structure_type.replace(/_/g, " ")}
          </span>
        </div>
        {offer.interest_rate != null && (
          <div className="px-4 py-3 flex justify-between">
            <span className="text-[#9b978f]">Interest rate</span>
            <span className="font-mono text-[#23211d]">
              {formatPercent(offer.interest_rate)}
            </span>
          </div>
        )}
        {offer.term_years != null && (
          <div className="px-4 py-3 flex justify-between">
            <span className="text-[#9b978f]">Term</span>
            <span className="font-mono text-[#23211d]">
              {offer.term_years} yr
            </span>
          </div>
        )}
        {offer.first_payment_defer_months > 0 && (
          <div className="px-4 py-3 flex justify-between col-span-2">
            <span className="text-[#9b978f]">
              First payment deferred
            </span>
            <span className="font-mono text-[#2f6d4f] font-semibold">
              {offer.first_payment_defer_months} months
            </span>
          </div>
        )}
        {offer.cap_rate != null && (
          <div className="px-4 py-3 flex justify-between">
            <span className="text-[#9b978f]">Cap rate</span>
            <span
              className={cn(
                "font-mono",
                offer.cap_rate >= 6
                  ? "text-[#2f6d4f]"
                  : offer.cap_rate >= 4
                  ? "text-[#9a6b3f]"
                  : "text-[#a8473a]"
              )}
            >
              {formatPercent(offer.cap_rate)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SummaryTab() {
  const { dataFields, offerStructures, activeDeal, documents } =
    useDealStore();

  const summaryFields = dataFields
    .filter((f) => f.category === "summary")
    .sort((a, b) => a.sort_order - b.sort_order);

  const incomeFields = dataFields.filter((f) => f.category === "income");
  const expenseFields = dataFields.filter((f) => f.category === "expense");

  const grossIncome = incomeFields
    .filter((f) => f.field_key.includes("gross") || f.field_key.includes("egi"))
    .reduce((sum, f) => sum + (f.field_value_numeric ?? 0), 0);

  const totalExpenses = expenseFields
    .filter((f) => !f.field_key.includes("total"))
    .reduce((sum, f) => sum + (f.field_value_numeric ?? 0), 0);

  const reportedNOI = grossIncome - totalExpenses;
  const expenseRatio =
    grossIncome > 0 ? (totalExpenses / grossIncome) * 100 : null;

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Offer structures — the headline section */}
      {offerStructures.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-[12px] font-bold text-[#3a3833] uppercase tracking-[0.04em]">
            Deal Structures
          </h3>
          {offerStructures.map((offer) => (
            <DebtServiceBlock key={offer.id} offer={offer} />
          ))}
        </div>
      )}

      {/* Financial summary */}
      {(grossIncome > 0 || summaryFields.length > 0) && (
        <div className="border border-[#e6e3dc] rounded-[10px] overflow-hidden">
          <div className="px-[13px] py-[9px] bg-[#f3f1ea] border-b border-[#e6e3dc]">
            <span className="text-[11px] font-semibold text-[#7d7869] uppercase tracking-[0.04em]">
              Financial Summary
            </span>
          </div>

          {grossIncome > 0 && (
            <>
              <KeyMetricBar
                label="Gross operating income"
                value={`${formatCentsFull(grossIncome * 100)}/yr`}
                tone="default"
              />
              <KeyMetricBar
                label="Total operating expenses"
                value={`${formatCentsFull(totalExpenses * 100)}/yr`}
                tone="default"
              />
              {expenseRatio != null && (
                <KeyMetricBar
                  label="Expense ratio"
                  value={formatPercent(expenseRatio)}
                  tone={
                    expenseRatio > 70
                      ? "negative"
                      : expenseRatio > 55
                      ? "amber"
                      : "positive"
                  }
                />
              )}
              <KeyMetricBar
                label="Reported NOI"
                value={`${formatCentsFull(reportedNOI * 100)}/yr`}
                tone={reportedNOI > 0 ? "positive" : "negative"}
                highlight
              />
              {activeDeal?.asking_price && reportedNOI > 0 && (
                <KeyMetricBar
                  label="Cap rate @ ask"
                  value={formatPercent(
                    (reportedNOI / (activeDeal.asking_price / 100)) * 100
                  )}
                  tone={
                    (reportedNOI / (activeDeal.asking_price / 100)) * 100 >= 6
                      ? "positive"
                      : (reportedNOI / (activeDeal.asking_price / 100)) * 100 >= 4
                      ? "amber"
                      : "negative"
                  }
                />
              )}
            </>
          )}

          {summaryFields.map((field) => {
            const val = field.field_value ?? (field.field_value_numeric != null
              ? String(field.field_value_numeric)
              : "—");
            return (
              <KeyMetricBar
                key={field.id}
                label={field.field_label}
                value={val}
                tone={
                  field.ai_note?.includes("low") ||
                  field.ai_note?.includes("concern")
                    ? "negative"
                    : field.ai_note?.includes("elevated")
                    ? "amber"
                    : "default"
                }
              />
            );
          })}
        </div>
      )}

      {grossIncome === 0 && summaryFields.length === 0 && offerStructures.length === 0 && (
        <div className="flex items-center justify-center py-16 text-center">
          <div>
            <p className="text-[14px] font-semibold text-[#23211d] mb-1">
              No summary data yet
            </p>
            <p className="text-[12px] text-[#9b978f]">
              Upload documents and ask AI to structure an offer to populate this
              tab.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
