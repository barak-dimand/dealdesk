# ADR-0001 — Adopt Supabase CLI migrations

**Status:** Accepted · 2026-08-07

## Context
All schema changes live as sequential `alter table ... add column if not exists` blocks
appended to a single hand-maintained `src/lib/supabase/schema.sql` (531 lines), applied by
pasting into the Supabase SQL editor. No versioning, no rollback, no drift detection, no
way to reset a development database.

The operations module adds roughly a dozen tables.

## Decision
Adopt the Supabase CLI migration system. Baseline the existing schema as
`supabase/migrations/0001_baseline.sql` unchanged. Every subsequent change is a new
numbered migration applied by tooling.

`schema.sql` is retired as a source of truth and deleted after baselining.

## Amendment — 2026-08-10
**The decision stands; the stated context was wrong.**

This ADR asserted that no migration tooling was in use, based on the codebase recon
report ("Migration tool: NONE"). On implementation, `supabase migration list --linked`
revealed the live database's history table already contains **six CLI-applied migrations**:
`initial_schema`, `loi_builder`, `recommendation_rebuild`, `chat_command_center`,
`platform_restructure_portfolio_crm_buyers`, `data_provenance`. Their names match feature
milestones in the git log. **No corresponding migration files exist in this repository.**

Consequences:
- Local migration files and the remote history table disagree. `supabase db push` and
  `supabase migration up` will report a mismatch until reconciled — by recovering the six
  historical files, or by `migration repair` to align the bookkeeping.
- This was deliberately **not** reconciled during Phase 0. Reconstructing six unknown
  historical migrations' contents is a judgment call, not a mechanical fix.

Also on implementation: `supabase db dump` shells out to a Dockerized `pg_dump`, so the
Docker-free path required assembling `0001_baseline.sql` from `list_tables`, `pg_policies`,
`pg_extension`, and `pg_constraint` introspection instead. **This is a reconstruction, not
a mechanical dump**, and has not been verified by rebuilding an empty database from
migrations `0001`–`0003`. Until that rebuild passes, the baseline is unproven.

Real drift found between the retired `schema.sql` and the live schema, vindicating the
decision to abandon the hand-maintained file:
1. `deals.status` default declared `'evaluating'`; actually `'analyzing'` live.
2. A `deal_loi_updated_at` trigger was declared but never applied.

**Outstanding:** rebuild-from-empty verification, and remote history reconciliation. Both
are cheapest now — the instance holds only test data and the app has never been deployed.

## Consequences
- Development databases become resettable and reproducible.
- Rollback becomes possible.
- Cost: one-time baselining, and the discipline that no schema change may be hand-applied.

## Alternatives rejected
- **Continue appending.** Retrofitting later requires reverse-engineering a baseline from
  production, which gets harder every week.
- **Adopt an ORM (Prisma/Drizzle) for migrations.** Larger change, would require rewriting
  the 15 existing routes' query style. Not justified by the problem being solved.
