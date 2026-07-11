/**
 * Tests the provenance history helpers that the PATCH handlers and the
 * parse route use (the route handlers are thin wrappers around these).
 */
import { describe, it, expect } from "vitest";
import {
  buildUserEditProvenance,
  buildReparseHistory,
  isValueEdit,
} from "@/lib/provenance";
import type { ValueHistoryEntry } from "@/types";

const EXISTING = {
  source_type: "ai_parsed" as const,
  source_document_id: "doc-1",
  source_text_snippet: "NOI: $35,761",
  source_confidence: "high",
  last_edited_by: null,
  last_edited_at: null,
  value_history: [] as ValueHistoryEntry[],
};

describe("provenance on user edit (PATCH)", () => {
  it("moves the old value to history before updating", () => {
    const updates = buildUserEditProvenance(EXISTING, "$35,761", 35761, "user_abc");
    const history = updates.value_history as ValueHistoryEntry[];
    expect(history).toHaveLength(1);
    expect(history[0].value).toBe("$35,761");
    expect(history[0].value_numeric).toBe(35761);
    expect(history[0].source_type).toBe("ai_parsed");
    expect(history[0].changed_by).toBe("AI");
  });

  it("sets source_type to user_edited and clears document linkage", () => {
    const updates = buildUserEditProvenance(EXISTING, "$35,761", 35761, "user_abc");
    expect(updates.source_type).toBe("user_edited");
    expect(updates.source_document_id).toBeNull();
    expect(updates.source_text_snippet).toBeNull();
  });

  it("sets last_edited_by to the userId", () => {
    const updates = buildUserEditProvenance(EXISTING, "$35,761", 35761, "user_abc");
    expect(updates.last_edited_by).toBe("user_abc");
    expect(updates.last_edited_at).toBeTruthy();
  });

  it("preserves prior history entries when appending", () => {
    const prior: ValueHistoryEntry = {
      value: "$30,000",
      value_numeric: 30000,
      source_type: "ai_parsed",
      source_document_id: "doc-0",
      source_document_name: "old.pdf",
      changed_at: "2026-06-01T00:00:00Z",
      changed_by: "AI",
      note: null,
    };
    const updates = buildUserEditProvenance(
      { ...EXISTING, value_history: [prior] },
      "$35,761",
      35761,
      "user_abc"
    );
    const history = updates.value_history as ValueHistoryEntry[];
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(prior);
  });
});

describe("provenance on re-parse", () => {
  it("adds an 'Overridden by [doc name]' note to history", () => {
    const history = buildReparseHistory(EXISTING, "$35,761", 35761, "T12-2026.pdf");
    expect(history).toHaveLength(1);
    expect(history[0].note).toBe("Overridden by T12-2026.pdf");
    expect(history[0].value).toBe("$35,761");
  });
});

describe("isValueEdit", () => {
  it("distinguishes value edits from flag-only updates", () => {
    const keys = ["field_value", "field_value_numeric"];
    expect(isValueEdit({ field_value_numeric: 5 }, keys)).toBe(true);
    expect(isValueEdit({ user_verified: true }, keys)).toBe(false);
  });
});
