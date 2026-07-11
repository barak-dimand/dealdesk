import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SummaryTab } from "../SummaryTab";
import { useDealStore } from "@/store/dealStore";
import {
  CALVERT_DEAL,
  CALVERT_UNITS,
  CALVERT_DATA_FIELDS,
} from "@/test/fixtures";
import type { Deal, DealUnit, DealDataField } from "@/types";

function seedStore(overrides: Record<string, unknown> = {}) {
  useDealStore.setState({
    activeDeal: CALVERT_DEAL as unknown as Deal,
    units: CALVERT_UNITS as unknown as DealUnit[],
    dataFields: CALVERT_DATA_FIELDS as unknown as DealDataField[],
    recommendation: null,
    offerStructures: [],
    ...overrides,
  });
}

describe("SummaryTab scorecard", () => {
  beforeEach(() => {
    localStorage.clear();
    seedStore();
  });

  it("renders the overall grade", () => {
    render(<SummaryTab />);
    const grade = screen.getByTestId("overall-grade");
    expect(grade).toBeInTheDocument();
    expect(["A", "B", "C", "D", "F"]).toContain(grade.textContent);
    expect(screen.getByText(/metrics graded/)).toBeInTheDocument();
  });

  it("shows N/A for null metrics", () => {
    render(<SummaryTab />);
    // No recommendation/offer structures seeded → DSCR & cash-on-cash ungradeable
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
    expect(screen.getByText("DSCR")).toBeInTheDocument();
  });

  it("shows the limited-data banner when >3 key metrics are null", () => {
    seedStore({ dataFields: [] });
    render(<SummaryTab />);
    expect(
      screen.getByText(/Limited data — upload income statement and rent roll/)
    ).toBeInTheDocument();
  });

  it("toggles between Scorecard and Full Detail views", () => {
    render(<SummaryTab />);
    expect(screen.getByTestId("overall-grade")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Full Detail"));
    expect(screen.queryByTestId("overall-grade")).not.toBeInTheDocument();
    // Detail view = the grid engine over raw parsed fields
    expect(screen.getByText("Gross Operating Income")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Scorecard"));
    expect(screen.getByTestId("overall-grade")).toBeInTheDocument();
  });

  it("renders all six sections", () => {
    render(<SummaryTab />);
    for (const section of [
      "Deal Overview",
      "Income Quality",
      "Expense Quality",
      "NOI & Valuation",
      "Financing & Returns",
      "Risk Flags",
    ]) {
      expect(screen.getByText(section)).toBeInTheDocument();
    }
  });

  it("shows the correct risk flags", () => {
    render(<SummaryTab />);
    // Calvert R&M is 19.2% of income → flagged
    expect(screen.getByText(/R&M at 19.2% of income/)).toBeInTheDocument();
    // Expense ratio is elevated → flagged
    expect(screen.getByText(/Expense ratio at .* verify against T12/)).toBeInTheDocument();
    // DSCR has no data (no financing seeded)
    expect(screen.getAllByText("No data to assess").length).toBeGreaterThan(0);
  });
});
