# ADR-0003 — Owned `units` are not unified with `deal_units`

**Status:** Accepted · 2026-08-07

## Context
`deal_units` exists and holds rent-roll rows with columns that closely resemble what an
owned unit needs. The temptation is to reuse it.

## Decision
Create a separate `units` table under `properties`. `deal_units` remains the acquisition
artifact. A promotion path (deal unit → owned unit on close) is added later.

## Rationale
A `deal_unit` is *an assertion from a seller's rent roll* — unverified, possibly inflated,
a negotiating input, discarded if the deal dies. A `unit` is *an asset under management*
with a real lease, a real tenant, and a compliance history.

Same columns, entirely different truth conditions and lifecycles. Collapsing them because
the shapes rhyme is over-abstraction: every consumer would need to know which kind it held,
which is the coupling the merge was supposed to avoid.

## Consequences
- Two tables with similar columns. Accepted deliberately.
- Verification semantics stay clean: `is_verified` on a deal unit means "I checked the
  rent roll"; on an owned unit it would mean "I have the lease."
