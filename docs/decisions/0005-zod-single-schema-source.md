# ADR-0005 — Zod schemas are the single source of entity shape

**Status:** Accepted · 2026-08-07

## Context
An entity's shape is defined three times with no enforced link: the `create table` columns,
the hand-written interface in `src/types/index.ts` (467 lines), and the literal object
passed to `.insert()` in each route. Adding a column requires remembering all three.

There is no runtime validation anywhere. Routes read `await req.json()` and access fields
with `?? null` fallbacks.

Separately, the natural-language query layer needs JSON tool schemas for Anthropic tool use.

## Decision
One Zod schema per entity, colocated with its domain, generating three consumers:
1. The TypeScript type (`z.infer`).
2. API boundary validation (parse at the edge, never trust `req.json()`).
3. Anthropic tool-use JSON schemas, via `zod-to-json-schema`.

## Consequences
- The query layer's tool definitions become nearly free — the primary "write less code" win.
- Structured questions get typed tool composition rather than embedding-and-hoping.
- Existing `types/index.ts` interfaces are **not** backfilled as a project. Convert
  opportunistically when a route is touched for other reasons.

## Alternatives rejected
- **Generate types from the database** (`supabase gen types`). Solves shape drift but not
  runtime validation and not tool schemas. Complementary, not a substitute.
