import type {
  DataProvenance,
  DataSourceType,
  ValueHistoryEntry,
} from "@/types";

/** Minimal shape of a row that carries provenance (field or unit) */
export interface ProvenanceRow {
  source_type?: DataSourceType | string | null;
  source_document_id?: string | null;
  source_text_snippet?: string | null;
  source_confidence?: string | null;
  last_edited_by?: string | null;
  last_edited_at?: string | null;
  value_history?: ValueHistoryEntry[] | null;
  user_verified?: boolean | null;
}

function historyOf(row: ProvenanceRow): ValueHistoryEntry[] {
  return Array.isArray(row.value_history) ? row.value_history : [];
}

function entryFor(
  row: ProvenanceRow,
  value: string,
  valueNumeric: number | null,
  documentName: string | null,
  note: string | null
): ValueHistoryEntry {
  const sourceType = (row.source_type ?? "ai_parsed") as DataSourceType;
  return {
    value,
    value_numeric: valueNumeric,
    source_type: sourceType,
    source_document_id: row.source_document_id ?? null,
    source_document_name: documentName,
    changed_at: new Date().toISOString(),
    changed_by: sourceType === "user_edited" ? row.last_edited_by ?? null : "AI",
    note,
  };
}

/**
 * A user is editing a value: the old value moves into history and the row
 * becomes user_edited (no source document — the user typed it).
 */
export function buildUserEditProvenance(
  existing: ProvenanceRow,
  oldValue: string,
  oldValueNumeric: number | null,
  userId: string
): Record<string, unknown> {
  return {
    value_history: [
      ...historyOf(existing),
      entryFor(existing, oldValue, oldValueNumeric, null, null),
    ],
    source_type: "user_edited",
    last_edited_by: userId,
    last_edited_at: new Date().toISOString(),
    source_document_id: null,
    source_text_snippet: null,
  };
}

/**
 * A re-parse (or a new document) is overriding an existing value: the old
 * value moves into history with an override note.
 */
export function buildReparseHistory(
  existing: ProvenanceRow,
  oldValue: string,
  oldValueNumeric: number | null,
  overridingDocumentName: string
): ValueHistoryEntry[] {
  return [
    ...historyOf(existing),
    entryFor(
      existing,
      oldValue,
      oldValueNumeric,
      null,
      `Overridden by ${overridingDocumentName}`
    ),
  ];
}

/** True when a PATCH body touches actual values (vs. flags like user_verified) */
export function isValueEdit(body: Record<string, unknown>, valueKeys: string[]): boolean {
  return valueKeys.some((k) => k in body);
}

/** Assemble UI-facing provenance from a row + document name lookup */
export function buildProvenance(
  row: ProvenanceRow,
  documentName: string | null
): DataProvenance | null {
  if (row.source_type == null && row.source_document_id == null && !historyOf(row).length) {
    return null; // legacy row, no provenance captured
  }
  const confidence = row.source_confidence;
  return {
    source_type: (row.source_type ?? "ai_parsed") as DataSourceType,
    source_document_id: row.source_document_id ?? null,
    source_document_name: documentName,
    source_document_url: null, // fetched on demand via the signed-url endpoint
    source_text_snippet: row.source_text_snippet ?? null,
    source_confidence:
      confidence === "high" || confidence === "medium" || confidence === "low"
        ? confidence
        : null,
    last_edited_by: row.last_edited_by ?? null,
    last_edited_at: row.last_edited_at ?? null,
    value_history: historyOf(row),
    user_verified: row.user_verified ?? false,
  };
}
