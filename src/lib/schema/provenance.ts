import { z } from "zod";
import { pgTimestamptz } from "./timestamp";

/**
 * Generalizes the existing `deal_data_fields` / `DataProvenance` pattern
 * (src/types/index.ts) for the operations domain. See BUILD.md P3 and ADR-0007:
 * no value may exist that can't answer "where did this come from and who said so."
 */
export const dataSourceType = z.enum([
  "ai_parsed", // extracted from a document by AI
  "ai_inferred", // AI made a reasonable guess, not explicitly stated
  "user_edited", // manually entered or changed by a user
  "calculated", // derived from other values (read-only)
]);
export type DataSourceType = z.infer<typeof dataSourceType>;

export const sourceConfidence = z.enum(["high", "medium", "low"]).nullable();

export const valueHistoryEntry = z.object({
  value: z.string(), // formatted display value at that time
  value_numeric: z.number().nullable(),
  source_type: dataSourceType,
  source_document_id: z.string().nullable(),
  changed_at: pgTimestamptz,
  changed_by: z.string().nullable(), // 'AI' or user display name
  note: z.string().nullable(),
});
export type ValueHistoryEntry = z.infer<typeof valueHistoryEntry>;

export const provenance = z.object({
  source_type: dataSourceType,
  source_document_id: z.string().nullable(),
  source_text_snippet: z.string().nullable(),
  source_confidence: sourceConfidence,
  asserted_by: z.string().nullable(), // 'AI', a user id/display name, or a system source
  as_of: pgTimestamptz, // when this fact was learned/asserted
  value_history: z.array(valueHistoryEntry),
  user_verified: z.boolean(),
});
export type Provenance = z.infer<typeof provenance>;
