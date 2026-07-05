/**
 * Critical path integration test: Recommendation → LOI.
 * If this breaks, the core product flow is broken.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OfferRecommendation } from "@/components/offer/OfferRecommendation";
import { useDealStore } from "@/store/dealStore";
import {
  CALVERT_DEAL,
  CALVERT_RECOMMENDATION,
  CALVERT_DATA_FIELDS,
  CALVERT_LOI_DRAFT,
} from "@/test/fixtures";
import type { Deal, DealRecommendation, DealDataField } from "@/types";

describe("Recommendation → LOI flow", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ loi: CALVERT_LOI_DRAFT }),
      })
    );
    useDealStore.setState({
      activeDeal: CALVERT_DEAL as unknown as Deal,
      recommendation: CALVERT_RECOMMENDATION as unknown as DealRecommendation,
      dataFields: CALVERT_DATA_FIELDS as unknown as DealDataField[],
      isGeneratingRec: false,
      loi: null,
      centerTab: "rec",
    });
  });

  it("generates an LOI from the Just Right scenario and navigates to the LOI tab", async () => {
    render(<OfferRecommendation />);

    fireEvent.click(
      screen.getByRole("button", { name: /Generate LOI from Just Right/ })
    );

    // 1. Fetch called with the correct scenario terms (field mapping included)
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/deals/test-deal-calvert/loi");
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body);
    expect(body.scenario).toEqual({
      purchase_price: 105000000,
      down_payment: 5250000,
      financed_amount: 99750000,
      interest_rate: 5.5,
      term_years: 30,
      // OfferScenario.first_payment_deferral_months → body first_payment_defer_months
      first_payment_defer_months: 2,
      has_balloon: false,
      name: "30-yr seller finance, 5.5%, IO 12mo, 5% down",
      structure_type: "seller_finance",
    });

    // 2. After the mock resolves: LOI stored, deal marked draft, tab switched
    await waitFor(() => {
      expect(useDealStore.getState().centerTab).toBe("loi");
    });
    expect(useDealStore.getState().loi).toEqual(CALVERT_LOI_DRAFT);
    expect(useDealStore.getState().activeDeal?.loi_state).toBe("draft");
  });
});
