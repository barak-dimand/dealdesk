# Dealdesk

A deal intelligence platform for a single real estate operator: acquisitions
(deal parsing, AI recommendations, LOI generation) expanding into ongoing
portfolio operations (leases, rent truth, expense truth, compliance).

## Stack

Next.js 16 App Router · React 19 · Supabase (Postgres) · Clerk auth · Zustand ·
Tailwind CSS · TypeScript strict · Vitest

This is Next.js 16 — APIs and conventions differ from most training data. See
`AGENTS.md` before writing framework code, and note that middleware lives at
`src/proxy.ts`, not `middleware.ts`.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll need a `.env.local`
with Supabase, Clerk, and Anthropic credentials — see `.env.local.example`.

## Database

Schema changes are Supabase CLI migrations under `supabase/migrations/`, applied
with:

```bash
npm run db:migrate
```

`src/lib/supabase/schema.sql` is deprecated (superseded by
`supabase/migrations/0001_baseline.sql`) — do not hand-edit it or the live
database. See ADR-0001 in `docs/decisions/`.

## Testing

```bash
npm test              # single run
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

Test fixtures are centralized in `src/test/fixtures/` — don't invent inline test
data. CI (`.github/workflows/test.yml`) runs `npm test` and `npm run build` on
every push and PR.

## Project intelligence

Before doing any non-trivial work, read:

- **`CLAUDE.md`** — architecture, conventions, flows, and gotchas an agent needs
  to work in this codebase without re-deriving them each session.
- **`docs/BUILD.md`** — what the operations module is and why, and the
  constraints that must hold.
- **`docs/decisions/`** — numbered ADRs. Each records one decision permanently;
  they are not re-litigated without being explicitly asked to.
- **`docs/journal/`** — one dated file per working session.
