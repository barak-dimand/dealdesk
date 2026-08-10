# Phase 0 — Hardening

**Goal:** make the codebase able to absorb a large new domain module.
**Target:** one working day.
**Prerequisite for:** every subsequent phase.

This checklist is written to be handed to Claude Code more or less as-is. Each task states
its own done condition. Do them in order — later tasks depend on earlier ones.

> **Read first:** `AGENTS.md`. This is Next.js 16; APIs and file structure differ from
> training data. Consult `node_modules/next/dist/docs/` before writing framework code.
> Middleware is `src/proxy.ts`, **not** `middleware.ts`. Do not rename it.

> **Two-strike rule on environment setup.** If a tool install, binary download, or
> dependency resolution fails **twice**, stop. Report what failed and what you tried, and
> move to the next task that is not blocked by it. Do not retry with variations, do not
> try alternate package managers, do not attempt to build from source. Environment
> problems are the operator's to solve outside the session — they are fast for a human
> with a terminal and catastrophic for an agent with a context window.

---

## Task 0 — Non-code, do this first

Send the property manager a request for:
- All current leases (all units).
- The gas / water / electric account numbers per property (§XVIII of the standard lease
  has blank fields for these).

Lease collection is human-latency-bound and is the longest pole in the entire project.
It runs in parallel with everything below.

---

## Task 1 — Baseline migrations (ADR-0001)

**Prerequisite, done by the operator outside this session:** install the Supabase CLI via
Homebrew (`brew install supabase/tap/supabase`), Scoop, or a Linux package. **Do not
install it through npm.** The npm postinstall script routinely fails to place the binary,
and global npm/pnpm installs are explicitly unsupported by the package itself.

### 1a — Write the baseline (no tooling required)
1. Copy `src/lib/supabase/schema.sql` verbatim to
   `supabase/migrations/0001_baseline.sql`. **Do not clean it up.** A baseline that does
   not match production is worse than an ugly one.
2. Add the ADR-0004 comment block above the RLS section stating the policies are
   intentionally inert.

Do this first. It is not blocked on anything.

### 1b — Verify and cut over (requires the CLI, **not** Docker)
3. `supabase init` if `supabase/config.toml` is absent.
4. `supabase link --project-ref <ref>` (ref is in the Supabase dashboard URL).
5. `supabase db dump --linked -f /tmp/production_schema.sql` — pulls the live schema
   without a local stack.
6. Diff `/tmp/production_schema.sql` against `0001_baseline.sql`. Expect cosmetic
   differences (ordering, quoting, `if not exists` clauses collapsed). What matters is
   that **no table, column, constraint, policy, trigger, or function is missing.**
   **Show the operator the diff before proceeding.**
7. Delete `src/lib/supabase/schema.sql`; note its retirement in `CLAUDE.md`.
8. Add an `npm run db:migrate` script wrapping `supabase db push`.

**Done when:** the baseline is confirmed to contain every object present in production,
and `schema.sql` is retired.

> **Docker is not required for Phase 0.** `supabase start` runs the full local stack and
> needs Docker Desktop; nothing in this phase needs it. Do not install Docker to satisfy
> this task. If a command demands it, you are on the wrong command.

---

## Task 2 — Zod foundation (ADR-0005)

1. `npm i zod zod-to-json-schema`.
2. Create `src/lib/schema/` with the shared building blocks that every domain reuses:
   - `money` — integer cents, matching the existing `bigint` convention.
   - `provenance` — `source_type`, `source_document_id`, `source_text_snippet`,
     `source_confidence`, `asserted_by`, `as_of`, `value_history`, `user_verified`.
   - `knowledge` — `knowledge_state`, `as_of`, `stale_after_days`. Absence and staleness
     are first-class (BUILD.md P1).
   - `validity` — `effective_from`, `effective_to` (ADR-0002).
3. Document the three-consumer pattern in `src/lib/schema/CLAUDE.md`: type via `z.infer`,
   boundary validation via `.parse()`, tool schema via `zodToJsonSchema`.

**Done when:** the blocks exist, are exported, and the convention is documented.

**Do not:** backfill Zod onto the 15 existing deal routes. Opportunistic only.

---

## Task 3 — `workspace_members` and `withWorkspace()` (ADR-0004)

1. Migration: create `workspace_members (workspace_id, clerk_user_id, role, created_at)`,
   unique on `(workspace_id, clerk_user_id)`. Backfill one row from
   `workspaces.owner_clerk_id` with role `owner`.
2. **Leave `owner_clerk_id` in place** for now — existing routes still read it. Its removal
   is a later, isolated migration.
3. Create `src/lib/auth/withWorkspace.ts`: resolves the Clerk user, looks up membership,
   and passes `{ workspaceId, role, supabase }` to the handler. Returns 401/403 itself.
4. Add a comment block at the top of the RLS section in `0001_baseline.sql` stating that
   policies are **intentionally inert** and pointing at ADR-0004. Do not delete them.

**Done when:** one route is converted to `withWorkspace()` as the reference
implementation, with a test proving a foreign workspace's data is not returned.

---

## Task 4 — Shared Anthropic client

1. Create `src/lib/ai/client.ts`: one instantiation, exported model constants
   (`MODEL_FAST`, `MODEL_DEEP`), and a helper for tool-use calls that accepts Zod schemas.
2. Replace the five ad-hoc `new Anthropic()` sites. Models are currently hardcoded inline
   across `chat/route.ts`, `parse/route.ts`, `generateLOI.ts`, `generateNotes.ts`, and
   `recommend.ts`.
3. Existing calls parse raw JSON from the response rather than using tool use. **Do not
   convert them now** — only centralize the client and models.

**Done when:** `grep -r "new Anthropic(" src/` returns exactly one result, and the existing
test suite still passes.

---

## Task 5 — Reference route

Build one complete vertical slice as the pattern every later route copies: migration →
Zod schema → `withWorkspace()` → handler → test.

Suggested: `entities` (ADR-0006). Small, genuinely needed by Phase 1, and touches nothing
existing.

**Done when:** the four LLC records exist in the database, created through the new route,
with test coverage.

---

## Task 6 — Documentation scaffold

1. `docs/BUILD.md`, `docs/decisions/` — already written; move into the repo.
2. `docs/journal/` — one dated file per working session. Definition-of-done for every task.
3. Rewrite the stock `README.md`. It is currently unmodified `create-next-app` boilerplate.
4. Update root `CLAUDE.md`:
   - Domain-first structure: `src/domains/<domain>/` holds schema, state machine, rules,
     and handlers together. Layer-first destroys context loading.
   - Point at `docs/BUILD.md` and `docs/decisions/` as required reading.
   - State that ADRs are not re-litigated without explicit instruction.
   - Note the retirement of `schema.sql`.
5. Verify and correct the stale "Known V1 Gaps" note — it claims Resend does not deliver
   while `sendLOI.ts` appears wired.
6. Decide on the unused `ai` (Vercel AI SDK) dependency: remove it or adopt it
   deliberately. It is currently dead weight that misleads about which SDK is in use.

**Done when:** a fresh Claude Code session can read `CLAUDE.md` and know where to look and
what not to relitigate.

---

## Explicitly not in Phase 0

| Item | When | Why |
|---|---|---|
| Cron / scheduled jobs | Phase 1 | Ships with the rules engine, when there is something to tick |
| Zod backfill on existing routes | Opportunistic | Never as a project |
| Converting existing AI calls to tool use | Phase 1 | Only the query layer needs it |
| Removing `workspaces.owner_clerk_id` | Later | Isolated migration once nothing reads it |
| Full `deals` address migration | Later | ADR-0002 |
| Prettier | Never, unless wanted | ESLint flat config is adequate |

---

## Exit criteria

Phase 0 is complete when **all** of these are true:

1. A new table can be added, applied, and rolled back by tooling.
2. One route exists using Zod validation and `withWorkspace()`, with a passing isolation
   test.
3. Exactly one Anthropic client instantiation exists.
4. The four entities are in the database.
5. `npm test` and `npm run build` pass; CI is green.
