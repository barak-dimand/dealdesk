import { z } from "zod";
import { pgTimestamptz } from "./timestamp";

/**
 * Absence and staleness are first-class states, not nulls (BUILD.md P1). A fact's
 * `knowledge_state` must be checkable independent of its value, so "we don't know" and
 * "we know it's zero" never collapse into the same null.
 *
 * - known    — currently believed true and within its freshness window
 * - stale    — was known, but `as_of` + `stale_after_days` has passed; needs re-confirmation
 * - unknown  — explicit gap; never asserted, or explicitly cleared
 * - pending  — a request to close the gap is outstanding (e.g. asked Doug, awaiting reply)
 */
export const knowledgeState = z.enum(["known", "stale", "unknown", "pending"]);
export type KnowledgeState = z.infer<typeof knowledgeState>;

export const knowledge = z.object({
  knowledge_state: knowledgeState,
  as_of: pgTimestamptz.nullable(), // when we learned it; null when never known
  stale_after_days: z.number().int().positive().nullable(), // null = never goes stale
});
export type Knowledge = z.infer<typeof knowledge>;
