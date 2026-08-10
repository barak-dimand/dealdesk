import { z } from "zod";

/**
 * Round-trips a Postgres `timestamptz` column as returned by PostgREST/
 * supabase-js. `z.iso.datetime()`'s defaults reject this: Postgres emits a
 * numeric UTC offset (`+00:00`), not the literal `Z` suffix, and its
 * fractional-second precision (microseconds, e.g. `.17294`) doesn't match
 * the 3-digit default. Found live 2026-08-10 (PHASE-0 Task 5) — the entities
 * route returned 400 on every insert while the row was written successfully,
 * because the response was validated with a plain `z.iso.datetime()`.
 */
export const pgTimestamptz = z.iso.datetime({ offset: true, precision: null });
