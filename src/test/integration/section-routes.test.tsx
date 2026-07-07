import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import OpportunitiesPage from "@/app/opportunities/page";
import PortfolioPage from "@/app/portfolio/page";
import ContactsPage from "@/app/crm/contacts/page";
import BuyersPage from "@/app/buyers/page";
import { useDealStore } from "@/store/dealStore";

describe("section routes render without crashing", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ deals: [] }) })
    );
    useDealStore.setState({ deals: [], isLoadingDeals: false });
  });

  it("/opportunities renders the list page", async () => {
    render(<OpportunitiesPage />);
    expect(screen.getByText("Opportunities")).toBeInTheDocument();
    expect(await screen.findByText("No opportunities yet")).toBeInTheDocument();
    expect(screen.getByText("New opportunity")).toBeInTheDocument();
  });

  it("/portfolio renders the empty state", () => {
    render(<PortfolioPage />);
    expect(screen.getByText("Portfolio")).toBeInTheDocument();
    expect(screen.getByText("No assets yet")).toBeInTheDocument();
    expect(
      screen.getByText("Close an opportunity to add it to your portfolio.")
    ).toBeInTheDocument();
  });

  it("/crm/contacts renders the empty state with filter chips", () => {
    render(<ContactsPage />);
    expect(screen.getByText("Contacts")).toBeInTheDocument();
    expect(screen.getByText("No contacts yet")).toBeInTheDocument();
    for (const chip of ["All", "Investor", "Lender", "Broker", "Seller", "Contractor"]) {
      expect(screen.getByText(chip)).toBeInTheDocument();
    }
  });

  it("/buyers renders the empty state with the AI match panel", () => {
    render(<BuyersPage />);
    expect(screen.getByText("Buyers")).toBeInTheDocument();
    expect(screen.getByText("No buyers yet")).toBeInTheDocument();
    expect(screen.getByText("AI Deal Matching")).toBeInTheDocument();
    expect(
      screen.getByText("Add buyers with buy boxes to see matches.")
    ).toBeInTheDocument();
  });
});
