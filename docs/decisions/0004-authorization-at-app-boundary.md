# ADR-0004 — Authorization at the application boundary; RLS is inert by design

**Status:** Accepted · 2026-08-07

## Context
RLS policies exist on every table, keyed off `current_setting('request.jwt.claims')`.
**They enforce nothing.** Every route uses `createAdminClient()` with
`SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely.

Actual isolation depends on each handler remembering `.eq("workspace_id", ...)`, with
`getWorkspaceId()` redefined ad hoc per route file. This looks secure and is not — the
most dangerous configuration available.

Separately, `workspaces.owner_clerk_id text not null unique` is a hard 1:1 lock. Scoped
access for the property manager and the 50/50 partner is expected eventually.

## Decision
1. Authorization lives at the application boundary in a single `withWorkspace()` route
   wrapper that resolves scope and injects it into the handler. No handler resolves
   workspace itself.
2. RLS policies are **documented as intentionally inert**, not deleted — deleting them
   invites a future session to "restore security" by re-adding policies that still won't
   fire.
3. Add `workspace_members (workspace_id, clerk_user_id, role)` now, with exactly one row.
   `withWorkspace()` resolves through it rather than through `owner_clerk_id`.
4. Every query tool takes a scope argument from day one, even while scope is always
   "everything."

## Consequences
- One auditable authorization path instead of N.
- Adding a second user later is a row insert plus role checks, not a rewrite.
- Cost: ~30 lines now; the alternative is auditing every tool for leaks later.

## Alternatives rejected
- **Wire Clerk↔Supabase JWTs so RLS actually fires.** Correct in principle, a
  disproportionate yak-shave, and it does not remove the need for the wrapper.
