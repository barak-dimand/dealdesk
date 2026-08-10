import { z } from "zod";

/**
 * Integer cents. Matches the existing `bigint` DB convention (see root CLAUDE.md,
 * "Money / units convention"). Never a float — dollars-and-cents math belongs in
 * formatCentsFull() at display time, not in stored values.
 */
export const money = z.number().int();
