# `src/lib/schema/` — one schema, three consumers

Per ADR-0005: an entity's shape is defined **once**, as a Zod schema colocated with its
domain (`src/domains/<domain>/schema.ts`), built from the shared blocks in this directory
(`money`, `provenance`, `knowledge`, `validity`). That single schema generates three things:

1. **The TypeScript type** — `z.infer<typeof entitySchema>`. Never hand-write a parallel
   interface in `types/index.ts` for anything built after Phase 0.
2. **API boundary validation** — `entitySchema.parse(await req.json())` at the top of the
   route handler. Never trust `req.json()` un-parsed; never hand-roll `?? null` coercion.
3. **Anthropic tool-use JSON schema** — `z.toJSONSchema(entitySchema)`, used when the query
   layer (Phase 1+) exposes an entity as a typed tool for the model to compose.

## Deviation from ADR-0005's literal text

ADR-0005 names `zod-to-json-schema` as the mechanism for consumer 3. That package is
unmaintained (its own README says so as of Nov 2025) and does not support Zod v4 schemas —
only a `zod/v3` compat shim. This project installs Zod v4. Per the maintainer's own
recommendation, consumer 3 uses **Zod v4's native `z.toJSONSchema()`** instead — same
outcome (one schema, three consumers), different mechanism. Confirmed with Barak
2026-08-10 rather than silently deviating from the ADR. `zod-to-json-schema` is not a
dependency of this project.

## Example

```ts
import { z } from "zod";
import { money, provenance, validity } from "@/lib/schema";

export const managementAgreementSchema = z.object({
  id: z.uuid(),
  entity_id: z.uuid(),
  counterparty_id: z.uuid(),
  fee_rate_bps: z.number().int(), // basis points, not a float percentage
  ...validity.shape,
  ...provenance.shape,
});

export type ManagementAgreement = z.infer<typeof managementAgreementSchema>;

// API boundary:
const parsed = managementAgreementSchema.parse(await req.json());

// Tool-use JSON schema:
const toolSchema = z.toJSONSchema(managementAgreementSchema);
```

## What's here

- `money.ts` — integer cents (`bigint` in DB). Never trust LLM arithmetic on this; format
  with `formatCentsFull()` at display time only.
- `provenance.ts` — `source_type`, `source_document_id`, `source_text_snippet`,
  `source_confidence`, `asserted_by`, `as_of`, `value_history`, `user_verified`. Generalizes
  the existing `deal_data_fields` pattern (ADR-0007): no LLM call writes to a domain table
  directly, and no asserted fact exists without an answer to "where did this come from."
- `knowledge.ts` — `knowledge_state` (`known | stale | unknown | pending`), `as_of`,
  `stale_after_days`. Absence and staleness are first-class states, not nulls (BUILD.md P1).
- `validity.ts` — `effective_from` / `effective_to` for relationships that change over time
  without the prior state being wrong (ADR-0002): ownership, management agreements, leases.
- `timestamp.ts` — `pgTimestamptz`, for validating any `timestamptz` column round-tripped
  from Supabase. **Always use this, never bare `z.iso.datetime()`**, for a value that came
  back from Postgres — PostgREST emits a numeric offset (`+00:00`) and microsecond
  precision, which `z.iso.datetime()`'s defaults reject. Found live 2026-08-10: the
  `entities` route returned 400 on every insert while the row was actually written,
  because the response was validated with a plain `z.iso.datetime()`. A schema tested only
  against a fake in-memory mock (whose `created_at` came from JS's `toISOString()`) will
  not catch this — it only surfaced when tested against the real database.

## Not backfilled

The 15 existing deal routes and `src/types/index.ts` are **not** migrated to this pattern
as a project (PHASE-0 Task 2). Convert a route opportunistically only when you're already
touching it for another reason.
