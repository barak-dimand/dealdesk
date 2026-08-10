# ADR-0007 — AI proposes; humans promote; the ledger records

**Status:** Accepted · 2026-08-07

## Context
Current practice is pasting invoices into a chat model and hand-carrying rows into
spreadsheets. Automating that path directly would let model output write to the ledger.

The pattern already exists in this codebase: `deal_chat_proposals` holds AI-proposed
changes awaiting acceptance, with `applied_change_ids`. `deal_data_fields` already carries
`source_type`, `source_document_id`, `source_text_snippet`, `source_confidence`,
`value_history`, and `user_verified`.

## Decision
**No LLM call writes to a domain table.** Extraction and assessment emit
`extraction_proposals` carrying confidence and a provenance pointer to the exact source
document. A promotion step commits them — automatic above a threshold for low-stakes kinds,
explicit for anything financial or legal.

A single source document may yield **N proposals of differing target kinds**. One Valley
Property invoice yields expenses, payment claims, and an occupancy signal simultaneously.

Provenance is mandatory on every asserted fact: no value may exist that cannot answer
"where did this come from and who said so."

## Consequences
- The ledger stays trustworthy enough to query, which is the entire premise of the
  natural-language layer.
- Generalizing `deal_chat_proposals` rather than inventing a mechanism keeps one pattern
  across both halves of the product.
- Cost: a review surface, and latency between document arrival and ledger truth.

## Alternatives rejected
- **Auto-commit above a confidence threshold, universally.** Extraction hazards observed in
  real documents — multi-period line items, off-cycle periods embedded in free text,
  manager markups — make silent commits of financial data unacceptable.
