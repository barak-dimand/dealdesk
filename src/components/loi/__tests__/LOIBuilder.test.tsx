import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LOIBuilder } from "../LOIBuilder";
import { useDealStore } from "@/store/dealStore";
import { CALVERT_LOI_DRAFT } from "@/test/fixtures";
import type { DealLOI, LOITerm } from "@/types";

// tiptap/ProseMirror does not run reliably in jsdom — stub the document editor
vi.mock("../LOIDocument", () => ({
  LOIDocument: ({ sections }: { sections: Array<{ id: string }> }) => (
    <div data-testid="loi-document">{sections.length} sections</div>
  ),
}));

const LOI = CALVERT_LOI_DRAFT as unknown as DealLOI;

const LOI_ALL_REQUIRED_FILLED: DealLOI = {
  ...LOI,
  terms: LOI.terms.map(
    (t): LOITerm => ({
      ...t,
      value: t.value ?? "Filled in",
      confidence: t.value ? t.confidence : "verified",
    })
  ),
};

describe("LOIBuilder", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
    useDealStore.setState({ activeDeal: null, loi: null });
  });

  it("loiState 'none' → renders Generate LOI CTA, no visible document", () => {
    render(<LOIBuilder dealId="test-deal-calvert" dealName="Calvert Apartments" loiState="none" loi={null} />);
    expect(screen.getByRole("button", { name: "Generate LOI" })).toBeVisible();
    expect(screen.getByTestId("loi-document")).not.toBeVisible();
  });

  it("loiState 'generating' → renders skeleton, no visible document or term panel", () => {
    render(<LOIBuilder dealId="test-deal-calvert" dealName="Calvert Apartments" loiState="generating" loi={null} />);
    expect(screen.getByText("AI is drafting your LOI…")).toBeVisible();
    expect(screen.getByTestId("loi-document")).not.toBeVisible();
    expect(screen.getByText("Key Terms")).not.toBeVisible();
  });

  it("loiState 'draft' → renders document and term panel", () => {
    render(<LOIBuilder dealId="test-deal-calvert" dealName="Calvert Apartments" loiState="draft" loi={LOI} />);
    expect(screen.getByTestId("loi-document")).toBeVisible();
    expect(screen.getByText("Key Terms")).toBeVisible();
    expect(screen.getByTestId("loi-document")).toHaveTextContent("8 sections");
  });

  it("loiState 'sent' → renders sent badge, document still visible", () => {
    render(<LOIBuilder dealId="test-deal-calvert" dealName="Calvert Apartments" loiState="sent" loi={LOI} />);
    expect(screen.getByText(/LOI Sent/)).toBeVisible();
    expect(screen.getByTestId("loi-document")).toBeVisible();
  });

  it("Send button is disabled when required terms are missing", () => {
    render(<LOIBuilder dealId="test-deal-calvert" dealName="Calvert Apartments" loiState="draft" loi={LOI} />);
    // CALVERT_LOI_DRAFT has earnest_money, buyer_name_entity, etc. missing
    expect(screen.getByRole("button", { name: /Send LOI/ })).toBeDisabled();
  });

  it("Send button is enabled when all required terms have values", () => {
    render(
      <LOIBuilder
        dealId="test-deal-calvert"
        dealName="Calvert Apartments"
        loiState="draft"
        loi={LOI_ALL_REQUIRED_FILLED}
      />
    );
    expect(screen.getByRole("button", { name: /Send LOI/ })).toBeEnabled();
  });
});
