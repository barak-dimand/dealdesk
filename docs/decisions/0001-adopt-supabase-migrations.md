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

**Outstanding at the time of this amendment:** rebuild-from-empty verification, and remote
history reconciliation. Both are cheapest now — the instance holds only test data and the
app has never been deployed. **Resolved same-day — see the second amendment below.**

## Amendment 2 — 2026-08-10 (later same day)
**Both outstanding items above are resolved. The baseline is proven.**

`supabase db reset --linked` (this CLI version supports resetting the *linked remote
project itself* from local migration files — no local Docker stack involved) applied
`0001`→`0002`→`0003` to the live project from empty, then ran the new `supabase/seed.sql`.
Verified against the pre-reset introspection captured for the first amendment: schema,
triggers (still exactly 2 — no `deal_loi_updated_at`), and RLS policies (18, one per
table) all match. `supabase migration list --linked` now shows local and remote in full
agreement — the six-entry (then eight, after `apply_migration`'s two additions) mismatch
is gone, resolved as a side effect of the reset rather than by reconstructing the six
unknown historical migration files.

Cost of this proof: the reset also deleted the 8 real deals and everything nested under
them (documents, data fields, units, messages, notes, offer structures, recommendations,
LOIs) that had accumulated in the same project outside this session's work. Backed up as
JSON before the reset (session-local only, not in the repo — contains real parsed
financials) and confirmed lost with Barak before proceeding; not restored. The 9 files in
the `deal-documents` storage bucket survived (the reset only touches the `public` schema)
and are now orphaned.

Exit criterion 1 ("a new table can be added, applied, and rolled back by tooling") is met.

## Amendment 3 — 2026-08-12
**Settles the standard command for applying new migrations. `apply_migration` is the
exception, not the path.**

The mismatch this ADR keeps describing recurred: PHASE-1 Task 1 used
`mcp__supabase__apply_migration` to apply `0004`/`0005` (reasonable at the time — no
Docker, and it worked), but that tool records its own auto-generated timestamp as the
version in the remote history table instead of the local filename. `supabase migration
list --linked` immediately showed the same shape of mismatch as Amendment 1: two
timestamped remote-only entries, two filename-only local entries.

This stops being cheap to clear with a reset once Task 2 (properties, real portfolio
backfill) lands, so it was settled now instead of deferred again:

1. **`supabase db push --linked` applies local migration files directly, keyed by their
   filename version, no Docker required.** This is now the documented standard path (also
   `npm run db:migrate`, corrected from a bare `supabase migration up` that defaulted to a
   local Docker target this environment doesn't have and had never actually been run).
2. **`supabase migration repair` aligns the bookkeeping without touching data or schema —
   confirmed empirically, not assumed.** `db push --linked --dry-run` refused with
   `LegacyDbPushMissingLocalError` while the mismatch existed; its own error message
   supplied the exact repair command. Ran
   `migration repair --status reverted 20260812104347 20260812104402 --linked` (the two
   stray `apply_migration` timestamps — this does not re-run or undo their SQL, only edits
   the history table) followed by `migration repair --status applied 0004 0005 --linked`
   (the two local files whose SQL had already run). `db push --linked --dry-run` then
   reported `"upToDate": true`.

`apply_migration` is not banned — it's a legitimate escape hatch if `db push` is ever
unavailable — but any session that uses it must immediately run the same repair sequence
before ending, documented now in root `CLAUDE.md` so this isn't rediscovered a third time.

## Consequences
- Development databases become resettable and reproducible.
- Rollback becomes possible.
- Cost: one-time baselining, and the discipline that no schema change may be hand-applied.

## Alternatives rejected
- **Continue appending.** Retrofitting later requires reverse-engineering a baseline from
  production, which gets harder every week.
- **Adopt an ORM (Prisma/Drizzle) for migrations.** Larger change, would require rewriting
  the 15 existing routes' query style. Not justified by the problem being solved.
