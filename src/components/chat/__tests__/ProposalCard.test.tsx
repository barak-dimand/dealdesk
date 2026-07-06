import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProposalCard } from "../ProposalCard";
import { CALVERT_PROPOSAL } from "@/test/fixtures";
import type { ChatProposal } from "@/types";

const PROPOSAL = CALVERT_PROPOSAL as unknown as ChatProposal;

describe("ProposalCard", () => {
  it("renders all changes with checkboxes, checked by default", () => {
    render(<ProposalCard proposal={PROPOSAL} onApply={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText(/Reported NOI/)).toBeInTheDocument();
    expect(screen.getByText(/Unit 470-6 rent/)).toBeInTheDocument();
    expect(screen.getByText(/LOI Draft — Seller Finance/)).toBeInTheDocument();
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
    for (const cb of checkboxes) expect(cb).toBeChecked();
    // loi_draft row shows summary instead of a diff
    expect(screen.getByText(/Full LOI draft · 8 sections · 8 terms/)).toBeInTheDocument();
  });

  it("Select all / Deselect all toggles every checkbox", () => {
    render(<ProposalCard proposal={PROPOSAL} onApply={vi.fn()} onReject={vi.fn()} />);
    // All checked initially → link reads "Deselect all"
    fireEvent.click(screen.getByText("Deselect all"));
    for (const cb of screen.getAllByRole("checkbox")) expect(cb).not.toBeChecked();
    fireEvent.click(screen.getByText("Select all"));
    for (const cb of screen.getAllByRole("checkbox")) expect(cb).toBeChecked();
  });

  it("individual checkbox toggles work", () => {
    render(<ProposalCard proposal={PROPOSAL} onApply={vi.fn()} onReject={vi.fn()} />);
    const noiCheckbox = screen.getByLabelText("Include Reported NOI");
    fireEvent.click(noiCheckbox);
    expect(noiCheckbox).not.toBeChecked();
    expect(screen.getByLabelText("Include Unit 470-6 rent")).toBeChecked();
    fireEvent.click(noiCheckbox);
    expect(noiCheckbox).toBeChecked();
  });

  it("Apply button shows the correct count and passes selected ids", () => {
    const onApply = vi.fn();
    render(<ProposalCard proposal={PROPOSAL} onApply={onApply} onReject={vi.fn()} />);
    expect(screen.getByText("Apply selected (3)")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Include Reported NOI"));
    expect(screen.getByText("Apply selected (2)")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Apply selected (2)"));
    expect(onApply).toHaveBeenCalledTimes(1);
    const ids = onApply.mock.calls[0][0] as string[];
    expect(ids.sort()).toEqual(["chg-2", "chg-3"]);
  });

  it("Apply button is disabled when nothing is checked", () => {
    render(<ProposalCard proposal={PROPOSAL} onApply={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getByText("Deselect all"));
    expect(screen.getByText("Apply selected (0)")).toBeDisabled();
  });

  it("Reject all fires the handler and a rejected proposal renders collapsed", () => {
    const onReject = vi.fn();
    const { rerender } = render(
      <ProposalCard proposal={PROPOSAL} onApply={vi.fn()} onReject={onReject} />
    );
    fireEvent.click(screen.getByText("Reject all"));
    expect(onReject).toHaveBeenCalledTimes(1);

    rerender(
      <ProposalCard
        proposal={{ ...PROPOSAL, status: "rejected" }}
        onApply={vi.fn()}
        onReject={onReject}
      />
    );
    expect(screen.getByText("Changes rejected")).toBeInTheDocument();
    expect(screen.queryByText(/Proposed Changes/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});
