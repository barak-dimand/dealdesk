# ADR-0006 — Entity and bank-account layer now; partner capital deferred

**Status:** Accepted · 2026-08-07

## Context
`workspaces` is 1:1 with a Clerk user. There is no owning entity, no bank account, no
partner. But the portfolio spans four owners: Easy Breezy LLC (Capital One), Imagine
Investments LLC (Chase, 50/50 partner), Everest Realty Solutions LLC (an **Ohio** LLC,
winding down), and one property in personal name.

Money crosses entity boundaries in both directions: the personal DSCR mortgage is debited
from Easy Breezy's account; Everest's Section 8 HAP was deposited into it. Three separate
Google Sheets are this missing layer, implemented where it was possible.

## Decision
Add now:
- `entities` — including `formation_state` (Everest is Ohio, operating in PA) and `status`
  (`active | winding_down | dissolved`).
- `bank_accounts` — belonging to entities.
- `ledger_entry.owning_entity` and `ledger_entry.paying_entity` as separate fields.
  `paying_entity ≠ owning_entity` is legal and expected; represented as a transfer with a
  due-from marker.

Defer to Phase 5: partner capital accounts, contributions, distributions, ownership
percentages, and intercompany settlement.

Also deferred: merging `crm_contacts` and `buyers` into `counterparty`. Operations uses a
new `counterparty` table; the acquisition-side tables fold in later.

## Consequences
- Commingling becomes representable rather than invisible.
- Retrofitting an entity dimension onto a populated ledger would mean re-attributing
  history from memory — the expensive kind of later.
- Cost: two small tables and two foreign keys.

## Note
Everest's wind-down means the $50k investor contribution needs settlement. This is a real
pending event waiting on the deferred work, not a hypothetical.
