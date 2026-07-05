import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OfferRecommendation } from "../OfferRecommendation";
import { useDealStore } from "@/store/dealStore";
import {
  CALVERT_DEAL,
  CALVERT_RECOMMENDATION,
  CALVERT_DATA_FIELDS,
  CALVERT_LOI_DRAFT,
} from "@/test/fixtures";
import type { Deal, DealRecommendation, DealDataField } from "@/types";

function seedStore(recommendation = CALVERT_RECOMMENDATION) {
  useDealStore.setState({
    activeDeal: CALVERT_DEAL as unknown as Deal,
    recommendation: recommendation as unknown as DealRecommendation,
    dataFields: CALVERT_DATA_FIELDS as unknown as DealDataField[],
    isGeneratingRec: false,
    loi: null,
    centerTab: "sheet",
  });
}

// Recommendation variant where the just_right scenario cash flows negative
const NEGATIVE_CF_RECOMMENDATION = {
  ...CALVERT_RECOMMENDATION,
  scenarios: CALVERT_RECOMMENDATION.scenarios.map((s) =>
    s.id === "just_right"
      ? { ...s, monthly_cash_flow: -50000, cash_flow_per_unit: -2800 }
      : s
  ),
};

describe("OfferRecommendation", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ loi: CALVERT_LOI_DRAFT }),
      })
    );
    seedStore();
  });

  it("renders verdict banner with correct tier color", () => {
    render(<OfferRecommendation />);
    expect(screen.getByText(CALVERT_RECOMMENDATION.verdict)).toBeInTheDocument();
    // Banner tier badge (lg) uses the just_right tier background
    const badges = screen.getAllByText("✅ Just Right");
    expect(badges.length).toBeGreaterThan(0);
    expect(badges[0]).toHaveStyle({ background: "#2f5d50" });
  });

  it("Walk Away card always shows 'pass' tier badge regardless of scenario.tier", () => {
    render(<OfferRecommendation />);
    // Fixture walk_away scenario has tier 'just_right' but must render as Pass
    expect(screen.getByText("❌ Pass")).toBeInTheDocument();
    // appears in both the scenario card and the "Generate LOI from" list
    expect(screen.getAllByText("Walk Away Number").length).toBeGreaterThan(0);
  });

  it("Home Run card shows 🏆 badge", () => {
    render(<OfferRecommendation />);
    expect(screen.getByText("🏆 Home Run")).toBeInTheDocument();
  });

  it("Just Right card shows Recommended pill", () => {
    render(<OfferRecommendation />);
    expect(screen.getByText("Recommended")).toBeInTheDocument();
  });

  it("cash flow waterfall shows correct math for just_right scenario", () => {
    render(<OfferRecommendation />);
    const grossRow = screen.getByText("Gross monthly income").parentElement!;
    expect(grossRow).toHaveTextContent("+$9,858");
    const noiRow = screen.getByText("Net Operating Income").parentElement!;
    expect(noiRow).toHaveTextContent("+$6,030");
    const cfRow = screen.getByText("Monthly cash flow").parentElement!;
    expect(cfRow).toHaveTextContent("+$1,458");
    expect(screen.getByText("+$81/unit")).toBeInTheDocument();
  });

  it("negative cash flow values render in red", () => {
    seedStore(NEGATIVE_CF_RECOMMENDATION);
    render(<OfferRecommendation />);
    // Waterfall total row for negative monthly cash flow
    const cfRow = screen.getByText("Monthly cash flow").parentElement!;
    const valueSpan = cfRow.querySelector("span.font-mono")!;
    expect(valueSpan).toHaveClass("text-[#a8473a]");
    // Metric cell on the just_right card: fmtSigned(-50000) = "-$500"
    const metric = screen.getByText("-$500");
    expect(metric).toHaveClass("text-[#a8473a]");
  });

  it("positive cash flow values render in green", () => {
    render(<OfferRecommendation />);
    // just_right monthly cash flow appears in metric cell and waterfall — both green
    const values = screen.getAllByText("+$1,458");
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) {
      expect(v).toHaveClass("text-[#2f6d4f]");
    }
  });

  it("Generate LOI from Just Right button calls the LOI endpoint with scenario terms", async () => {
    render(<OfferRecommendation />);
    fireEvent.click(
      screen.getByRole("button", { name: /Generate LOI from Just Right/ })
    );

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/deals/test-deal-calvert/loi");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.scenario.purchase_price).toBe(105000000);
    expect(body.scenario.structure_type).toBe("seller_finance");
  });
});
