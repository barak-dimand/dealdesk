import { describe, it, expect } from "vitest";
import {
  detectUnit,
  toAnnualDollars,
  resolveField,
  dedupeFields,
  computeMetrics,
  gradeMetric,
} from "../normalize";
import { CALVERT_UNITS, CALVERT_DATA_FIELDS } from "@/test/fixtures";
import type { MetricUnitInput, MetricFieldInput } from "../normalize";

const UNITS = CALVERT_UNITS as unknown as MetricUnitInput[];

const CENTS_FIELD: MetricFieldInput = {
  field_key: "gross_operating_income",
  field_value: "$136,405/yr",
  field_value_numeric: 13640500,
  created_at: "2026-01-01T00:00:00Z",
};

const DOLLARS_FIELD: MetricFieldInput = {
  field_key: "gross_operating_income",
  field_value: "$136,405/yr",
  field_value_numeric: 136405,
  created_at: "2026-01-02T00:00:00Z",
};

describe("detectUnit / toAnnualDollars", () => {
  it("detectUnit correctly identifies cents vs dollars", () => {
    expect(detectUnit(CENTS_FIELD)).toBe("cents");
    expect(detectUnit(DOLLARS_FIELD)).toBe("dollars");
    // Percent drift: "3.20%" stored as 320
    expect(
      detectUnit({ field_key: "cap_rate_at_ask", field_value: "3.20%", field_value_numeric: 320 })
    ).toBe("cents");
    expect(
      detectUnit({ field_key: "cap_rate_asking", field_value: "3.18", field_value_numeric: 3.18 })
    ).toBe("dollars");
  });

  it("toAnnualDollars converts cents correctly", () => {
    expect(toAnnualDollars(CENTS_FIELD)).toBe(136405);
    expect(toAnnualDollars(DOLLARS_FIELD)).toBe(136405);
  });
});

describe("resolveField", () => {
  it("finds the canonical key", () => {
    expect(resolveField([DOLLARS_FIELD], "gross_operating_income")).toBe(136405);
  });

  it("finds an aliased key (cap_rate_asking → cap_rate_at_ask)", () => {
    const fields: MetricFieldInput[] = [
      { field_key: "cap_rate_asking", field_value: "3.18", field_value_numeric: 3.18 },
    ];
    expect(resolveField(fields, "cap_rate_at_ask")).toBe(3.18);
    expect(resolveField(fields, "gross_rent_multiplier")).toBeNull();
  });
});

describe("dedupeFields", () => {
  it("keeps the most recent field when duplicates exist (across aliases)", () => {
    const older: MetricFieldInput = {
      field_key: "annual_gross_income",
      field_value: "$100,000/yr",
      field_value_numeric: 100000,
      created_at: "2026-01-01T00:00:00Z",
    };
    const newer: MetricFieldInput = {
      field_key: "gross_operating_income",
      field_value: "$136,405/yr",
      field_value_numeric: 136405,
      created_at: "2026-06-01T00:00:00Z",
    };
    const deduped = dedupeFields([older, newer]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].field_value_numeric).toBe(136405);
  });
});

describe("computeMetrics", () => {
  it("calculates GPR from units when the field is missing", () => {
    const m = computeMetrics({ unit_count: 18 }, UNITS, [], null, []);
    // Σ market_rent = 10×$825 + 8×$700 = $13,850/mo
    expect(m.grossPotentialRent).toBe(13850);
  });

  it("calculates physical vacancy rate from units", () => {
    const m = computeMetrics({ unit_count: 18 }, UNITS, [], null, []);
    expect(m.vacantUnits).toBe(1);
    expect(m.physicalVacancyRate).toBeCloseTo((1 / 18) * 100, 2);
    // vacancyRate falls back to physical when not parsed
    expect(m.vacancyRate).toBeCloseTo(5.56, 1);
  });

  it("returns null for metrics with no data", () => {
    const m = computeMetrics({}, [], [], null, []);
    expect(m.grossPotentialRent).toBeNull();
    expect(m.reportedNOI).toBeNull();
    expect(m.dscr).toBeNull();
    expect(m.cashOnCash).toBeNull();
    expect(m.breakEvenOccupancy).toBeNull();
    expect(m.expenseRatio).toBeNull();
  });

  it("uses alias resolution and the cents fix together", () => {
    const m = computeMetrics(
      { unit_count: 18 },
      UNITS,
      CALVERT_DATA_FIELDS as unknown as MetricFieldInput[],
      null,
      []
    );
    // Fixture stores cents (13,640,500) — normalized to $136,405
    expect(m.grossOperatingIncome).toBe(136405);
    // total_expenses_annual alias → total_expenses, cents → $100,644
    expect(m.totalExpenses).toBe(100644);
    // reported_noi resolved and normalized
    expect(m.reportedNOI).toBe(35761);
    // R&M % of income: 26,247 / 136,405 = 19.2%
    expect(m.rmPctIncome).toBeCloseTo(19.24, 1);
    expect(m.rmRatioFlag).toBe(true);
  });
});

describe("gradeMetric thresholds", () => {
  it("cap rate: 9% → A, 7% → B, 5% → C, 4% → D, 3.5% → F", () => {
    expect(gradeMetric("capRate", 9)).toBe("A");
    expect(gradeMetric("capRate", 7)).toBe("B");
    expect(gradeMetric("capRate", 5)).toBe("C");
    expect(gradeMetric("capRate", 4)).toBe("D");
    expect(gradeMetric("capRate", 3.5)).toBe("F");
    expect(gradeMetric("capRate", null)).toBeNull();
  });

  it("lower-is-better metrics grade correctly", () => {
    expect(gradeMetric("expenseRatio", 35)).toBe("A");
    expect(gradeMetric("expenseRatio", 52)).toBe("C");
    expect(gradeMetric("expenseRatio", 65)).toBe("F");
    expect(gradeMetric("dscr", 1.45)).toBe("A");
    expect(gradeMetric("dscr", 1.0)).toBe("F");
  });
});
