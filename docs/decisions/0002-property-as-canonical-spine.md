# ADR-0002 — `properties` is the canonical building entity

**Status:** Accepted · 2026-08-07

## Context
A building has no row today. It exists as `deals.address/city/state` before close and
`portfolio_assets.address/city/state` after, linked only by nullable `origin_deal_id`.

Every operations concern — citations, policies, utility accounts, units, leases, work
orders, documents — needs a foreign key to the building. Address resolution is the
highest-frequency operation in intake, and doing it against two tables that can disagree
is a permanent bug source.

## Decision
Create `properties` as canonical. Backfill from `portfolio_assets` (~20 units, a manual
afternoon). All new operations tables reference `properties` only. Add nullable
`deals.property_id`, populated on close.

Leave `deals.address` in place as a denormalized snapshot. Documented rule: **`properties`
wins on conflict.** Migrating `deals` fully is deferred to a later, isolated step.

Properties carry lifecycle: `status` (`active | listed | sold`) and a `disposition` record
(sale date, price, closing costs, net proceeds). **A sold property is never deleted,
hidden, or archived** — it is the only source of a realized return.

Relationships carry `effective_from` / `effective_to`: property↔entity ownership,
management agreements and their fee rates, leases.

## Consequences
- Cross-domain queries become single joins.
- Two address representations coexist temporarily, with an explicit precedence rule.
- Cost: a manual reconciliation of three spreadsheets into one property list, once.

## Alternatives rejected
- **Bolt operations onto `portfolio_assets`.** Saves ~2 days; charges interest on every
  cross-domain query for the life of the project, and strands acquisition-era documents.
- **Full migration of `deals` now.** Touches LOI generation, the recommendation engine,
  and the spreadsheet components — the only code with integration test coverage — while
  simultaneously standing up a new domain and before migrations exist.

## Evidence
1002 Webster sold 2026-07-28 mid-design. The model absorbed it additively, which is the
signal the spine is correct.
