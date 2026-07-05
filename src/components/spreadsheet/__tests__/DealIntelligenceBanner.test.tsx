import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DealIntelligenceBanner } from "../DealIntelligenceBanner";
import { useDealStore } from "@/store/dealStore";
import {
  CALVERT_DEAL,
  CALVERT_UNITS,
  CALVERT_DATA_FIELDS,
  CALVERT_RECOMMENDATION,
  CALVERT_PARSED_DOCUMENT,
} from "@/test/fixtures";
import type {
  Deal,
  DealUnit,
  DealDataField,
  DealDocument,
  DealRecommendation,
} from "@/types";

function seedStore(overrides: Record<string, unknown> = {}) {
  useDealStore.setState({
    activeDeal: CALVERT_DEAL as unknown as Deal,
    units: CALVERT_UNITS as unknown as DealUnit[],
    dataFields: CALVERT_DATA_FIELDS as unknown as DealDataField[],
    documents: [CALVERT_PARSED_DOCUMENT] as unknown as DealDocument[],
    recommendation: null,
    centerTab: "sheet",
    ...overrides,
  });
}

describe("DealIntelligenceBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    seedStore();
  });

  it("renders value-add section with correct rent upside calculation", () => {
    render(<DealIntelligenceBanner />);
    // Sum of (market - current) across CALVERT_UNITS below market = 246,700 cents/mo
    expect(
      screen.getByText(/Rent upside available: \+\$2,467\/mo \(\+\$29,604\/yr\)/)
    ).toBeInTheDocument();
    // 1 vacant unit (470-6, market $825)
    expect(screen.getByText(/1 vacant unit — filling adds ~\$825\/mo/)).toBeInTheDocument();
    expect(screen.getByText(/units >10% below market — lease renewal opportunity/)).toBeInTheDocument();
  });

  it("renders risk flags from parse warnings and derived checks", () => {
    render(<DealIntelligenceBanner />);
    // From document parse_warnings
    expect(
      screen.getByText(/Repairs & Maintenance elevated at 19.2% of Annual Gross Income/)
    ).toBeInTheDocument();
    // Derived: R&M ratio from data fields (2624700 / 13640500 = 19.2%)
    expect(
      screen.getByText(/R&M at 19.2% of income — request 3 years of repair invoices/)
    ).toBeInTheDocument();
    // Derived: credit-status unit 490-4
    expect(
      screen.getByText(/Non-standard rent arrangement on unit 490-4 — verify lease terms/)
    ).toBeInTheDocument();
  });

  it("next steps change based on deal state", () => {
    // No recommendation → rec CTA, and clicking switches to the rec tab
    const { unmount } = render(<DealIntelligenceBanner />);
    const recCta = screen.getByText(/Generate AI recommendation to see offer scenarios/);
    expect(recCta).toBeInTheDocument();
    fireEvent.click(recCta);
    expect(useDealStore.getState().centerTab).toBe("rec");
    unmount();

    // Has recommendation but no LOI → LOI CTA replaces rec CTA
    seedStore({
      recommendation: CALVERT_RECOMMENDATION as unknown as DealRecommendation,
    });
    render(<DealIntelligenceBanner />);
    expect(screen.getByText(/Generate LOI from recommended offer/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Generate AI recommendation to see offer scenarios/)
    ).not.toBeInTheDocument();
    // Recommendation's documents_needed list is shown
    expect(screen.getByText(/T-12 trailing twelve months P&L/)).toBeInTheDocument();
  });

  it("collapses and expands correctly", () => {
    render(<DealIntelligenceBanner />);
    expect(screen.getByText("Value Add Opportunities")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Collapse intelligence banner"));
    expect(screen.queryByText("Value Add Opportunities")).not.toBeInTheDocument();
    expect(screen.getByText(/opportunities · \d+ risks · \d+ next steps/)).toBeInTheDocument();
    // Collapsed state persisted per deal
    expect(localStorage.getItem("dealdesk_intel_collapsed_test-deal-calvert")).toBe("1");

    fireEvent.click(screen.getByLabelText("Expand intelligence banner"));
    expect(screen.getByText("Value Add Opportunities")).toBeInTheDocument();
    expect(localStorage.getItem("dealdesk_intel_collapsed_test-deal-calvert")).toBe("0");
  });
});
