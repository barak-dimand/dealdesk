import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppSidebar } from "../AppSidebar";
import { useDealStore } from "@/store/dealStore";

// Mutable pathname so tests can drive the active state
const { pathnameRef } = vi.hoisted(() => ({ pathnameRef: { current: "/" } }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "test-deal-id" }),
}));

describe("AppSidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    pathnameRef.current = "/";
    useDealStore.setState({ deals: [], isLoadingDeals: false });
  });

  it("renders all 5 nav items", () => {
    render(<AppSidebar />);
    for (const label of ["Dashboard", "Opportunities", "Portfolio", "CRM", "Buyers"]) {
      expect(screen.getByRole("link", { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("highlights the active section based on pathname, including sub-routes", () => {
    pathnameRef.current = "/opportunities/some-deal-id";
    render(<AppSidebar />);
    expect(screen.getByRole("link", { name: /Opportunities/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: /Dashboard/ })).not.toHaveAttribute(
      "aria-current"
    );
    expect(screen.getByRole("link", { name: /Portfolio/ })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("shows the deal rail sub-list when Opportunities is active", () => {
    pathnameRef.current = "/opportunities";
    render(<AppSidebar />);
    // DealRail's new-deal button renders inline in the sidebar
    expect(screen.getByText(/New deal · upload files/)).toBeInTheDocument();
  });

  it("collapses to icons and expands back, persisting to localStorage", () => {
    render(<AppSidebar />);
    expect(screen.getByText("Portfolio")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Collapse sidebar"));
    // Labels are hidden when collapsed (only icons + tooltips remain)
    expect(screen.queryByText("Portfolio")).not.toBeInTheDocument();
    expect(localStorage.getItem("dealdesk_sidebar")).toBe("collapsed");

    fireEvent.click(screen.getByLabelText("Expand sidebar"));
    expect(screen.getByText("Portfolio")).toBeInTheDocument();
    expect(localStorage.getItem("dealdesk_sidebar")).toBe("expanded");
  });

  it("renders nothing on auth routes", () => {
    pathnameRef.current = "/sign-in";
    const { container } = render(<AppSidebar />);
    expect(container).toBeEmptyDOMElement();
  });
});
