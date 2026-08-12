# ADR-0009 — `documents` and `deal_documents` coexist temporarily

**Status:** Accepted · 2026-08-12

## Context
The operations module needs a general-purpose document table: `workspace_id`, `sha256`
dedup, a `source` enum (`upload | email | whatsapp | buildium | portal | settlement |
manual`) wider than acquisitions ever needed, and nullable links to `property_id`,
`unit_id`, `lease_id`, `counterparty_id`, `deal_id` — a document can arrive before any of
those exist.

`deal_documents` already exists, is deal-scoped only, has no `sha256`, and is deeply wired
into the acquisitions flow: `extractText.ts` → `parseDocument.ts` → `ParseReviewModal`,
signed URLs, `deal_data_fields` provenance pointers, `deal_units` provenance pointers. Its
column shape assumes a `deal_id` is always present.

## Decision
Add `documents` as a new, separate table. `deal_documents` is untouched this phase.
`documents` gets its own storage bucket (`documents`, private, mirroring `deal-documents`),
its own Zod schema, and its own route under `withWorkspace()`.

Both tables exist simultaneously. This is accepted duplication, not an oversight.

## Consequences
- Two document tables with overlapping shape (name, file_type, storage_path, file_size,
  status/parse fields) coexist. A future session must not "clean this up" by merging them
  without a superseding ADR — see ADR-0007's `crm_contacts`/`buyers` → `counterparty`
  precedent for the same deferred-merge pattern.
- The acquisitions parsing pipeline (`extractText.ts`, `parseDocument.ts`, vision path,
  `ParseReviewModal`) is **not** repointed at `documents` this phase. Phase 1 Task 5
  (lease intake) reuses that pipeline's logic but writes to `documents`/`extraction_proposals`,
  not `deal_documents`.
- Cost: two document upload code paths, two storage buckets, until the merge happens.

## Intended sunset
Once acquisitions (`deals`) and operations share enough of the domain model that a closed
deal's documents naturally belong under the same table as an owned property's documents —
plausibly when `deals.property_id` (ADR-0002) is populated on close — a superseding ADR
should fold `deal_documents` into `documents` and backfill. Not attempted now: it would
touch the recommendation engine, LOI generation, and the spreadsheet components while
Phase 1 is still standing up the domain this would merge into.

## Alternatives rejected
- **Add the operations columns to `deal_documents` directly.** Rejected: conflates two
  different truth conditions (an acquisition document has no property/unit/lease to link to
  until a deal closes) the same way ADR-0003 rejected unifying `deal_units` with `units`.
- **Repoint the existing parsing pipeline at `documents` now.** Rejected: the pipeline is
  the single largest, most test-covered surface in the acquisitions product. Repointing it
  mid-Phase-1, before `properties`/`units`/`leases` exist to link into, would touch working
  code for no immediate benefit.
