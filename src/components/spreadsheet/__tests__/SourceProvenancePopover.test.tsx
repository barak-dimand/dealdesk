import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { SourceProvenancePopover } from "../SourceProvenancePopover";
import { SpreadsheetEngine } from "../core/SpreadsheetEngine";
import type { DataProvenance, ValueHistoryEntry } from "@/types";

function makeHistory(n: number): ValueHistoryEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    value: `$${35000 + i * 100}`,
    value_numeric: 35000 + i * 100,
    source_type: "ai_parsed" as const,
    source_document_id: "doc-1",
    source_document_name: "T12-2025.pdf",
    changed_at: `2026-06-${String(10 + i).padStart(2, "0")}T12:00:00Z`,
    changed_by: "AI",
    note: null,
  }));
}

const AI_PROV: DataProvenance = {
  source_type: "ai_parsed",
  source_document_id: "doc-1",
  source_document_name: "T12-2025.pdf",
  source_document_url: null,
  source_text_snippet: "Net Operating Income: $35,761 (after all operating expenses)",
  source_confidence: "high",
  last_edited_by: null,
  last_edited_at: null,
  value_history: makeHistory(2),
  user_verified: false,
};

function renderPopover(overrides: Partial<DataProvenance> = {}, extraProps = {}) {
  return render(
    <SourceProvenancePopover
      open
      onClose={vi.fn()}
      anchor={{ x: 100, y: 100 }}
      fieldLabel="Reported NOI"
      value="$35,761"
      provenance={{ ...AI_PROV, ...overrides }}
      dealId="deal-1"
      verifyTarget={{ kind: "field", id: "field-1" }}
      {...extraProps}
    />
  );
}

describe("SourceProvenancePopover", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
  });

  it("renders field label and current value", () => {
    renderPopover();
    expect(screen.getByText("Reported NOI")).toBeInTheDocument();
    expect(screen.getByText("$35,761")).toBeInTheDocument();
  });

  it("shows document name and snippet for ai_parsed source", () => {
    renderPopover();
    expect(screen.getByText("📄 AI Parsed")).toBeInTheDocument();
    expect(screen.getByText("T12-2025.pdf")).toBeInTheDocument();
    expect(
      screen.getByText(/Net Operating Income: \$35,761 \(after all operating expenses\)/)
    ).toBeInTheDocument();
  });

  it("shows AI Inferred badge for ai_inferred source", () => {
    renderPopover({ source_type: "ai_inferred", source_confidence: "medium" });
    expect(screen.getByText("~ AI Inferred")).toBeInTheDocument();
  });

  it("shows User Edited badge with editor name for user_edited", () => {
    renderPopover({
      source_type: "user_edited",
      last_edited_by: "Barak",
      last_edited_at: "2026-07-01T14:34:00Z",
    });
    expect(screen.getByText("✏️ User Edited")).toBeInTheDocument();
    expect(screen.getByText(/Manually edited by Barak/)).toBeInTheDocument();
  });

  it("history section renders up to 5 entries with a show-all link", () => {
    renderPopover({ value_history: makeHistory(7) });
    expect(screen.getByText("History")).toBeInTheDocument();
    // 7 entries → 5 shown + show-all link
    expect(screen.getAllByText(/AI · T12-2025.pdf/)).toHaveLength(5);
    expect(screen.getByText("Show all 7 changes")).toBeInTheDocument();
  });

  it("Open source document link appears for ai_parsed with a document", () => {
    renderPopover();
    expect(screen.getByText("Open source document →")).toBeInTheDocument();
  });

  it("Mark as verified calls the correct API", async () => {
    renderPopover();
    fireEvent.click(screen.getByText("Mark as verified ✓"));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/deals/deal-1/data-fields/field-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ user_verified: true }),
        })
      );
    });
  });

  it("verified cells show a check overlay instead of the colored dot", () => {
    interface Row {
      name: string;
      verified: boolean;
    }
    const columns: ColumnDef<Row, unknown>[] = [
      {
        id: "name",
        header: "Name",
        accessorKey: "name",
        size: 120,
        meta: {
          type: "text",
          getProvenance: (r) => ({
            ...AI_PROV,
            user_verified: r.verified,
          }),
        },
      },
    ];
    render(
      <SpreadsheetEngine<Row>
        columns={columns}
        data={[
          { name: "Verified", verified: true },
          { name: "Unverified", verified: false },
        ]}
        dealId="deal-1"
        tableId="prov-test"
      />
    );
    expect(screen.getByTestId("verified-mark")).toBeInTheDocument();
    expect(screen.getByTestId("source-dot")).toBeInTheDocument();
  });
});
