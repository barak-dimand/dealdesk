import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { LOITermPanel } from "../LOITermPanel";
import { CALVERT_LOI_DRAFT } from "@/test/fixtures";
import type { LOITerm } from "@/types";

const TERMS = CALVERT_LOI_DRAFT.terms as LOITerm[];

const OPTIONAL_MISSING_TERM: LOITerm = {
  id: "commission_handling",
  label: "Commission Handling",
  value: null,
  value_numeric: null,
  confidence: "missing",
  source: null,
  is_required: false,
  affected_section_ids: [],
};

function getRow(label: string): HTMLElement {
  const labelEl = screen.getByText(label);
  return labelEl.closest(".group") as HTMLElement;
}

describe("LOITermPanel", () => {
  it("renders all terms passed as props", () => {
    render(<LOITermPanel terms={TERMS} onTermChange={vi.fn()} onReset={vi.fn()} />);
    for (const term of TERMS) {
      expect(screen.getByText(term.label)).toBeInTheDocument();
    }
  });

  it("required + missing term shows red border and Required label", () => {
    render(<LOITermPanel terms={TERMS} onTermChange={vi.fn()} onReset={vi.fn()} />);
    const row = getRow("Earnest Money Deposit");
    const input = within(row).getByRole("textbox");
    expect(input).toHaveClass("border-[#a8473a]");
    expect(within(row).getByText("Required")).toBeInTheDocument();
  });

  it("optional + missing term shows grey indicator and NO red border", () => {
    render(
      <LOITermPanel
        terms={[...TERMS, OPTIONAL_MISSING_TERM]}
        onTermChange={vi.fn()}
        onReset={vi.fn()}
      />
    );
    const row = getRow("Commission Handling");
    const input = within(row).getByRole("textbox");
    expect(input).not.toHaveClass("border-[#a8473a]");
    expect(within(row).getByText("–")).toBeInTheDocument();
    expect(within(row).queryByText("Required")).not.toBeInTheDocument();
  });

  it("verified term shows green ✓", () => {
    render(<LOITermPanel terms={TERMS} onTermChange={vi.fn()} onReset={vi.fn()} />);
    const row = getRow("Due Diligence Period");
    const check = within(row).getByText("✓");
    expect(check).toHaveClass("text-[#2f6d4f]");
  });

  it("editing a term input calls onTermChange with correct termId and new value", () => {
    const onTermChange = vi.fn();
    render(<LOITermPanel terms={TERMS} onTermChange={onTermChange} onReset={vi.fn()} />);
    const row = getRow("Earnest Money Deposit");
    const input = within(row).getByRole("textbox");
    fireEvent.change(input, { target: { value: "$10,000" } });
    expect(onTermChange).toHaveBeenCalledWith("earnest_money", "$10,000");
  });

  it("Reset button calls onReset with correct termId", () => {
    const onReset = vi.fn();
    render(<LOITermPanel terms={TERMS} onTermChange={vi.fn()} onReset={onReset} />);
    const row = getRow("Offer Price");
    fireEvent.click(within(row).getByText("Reset"));
    expect(onReset).toHaveBeenCalledWith("offer_price");
  });
});
