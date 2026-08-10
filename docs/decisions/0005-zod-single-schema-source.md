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
3. Anthropic tool-use JSON schemas.

## Amendment — 2026-08-10
**The decision stands; the mechanism changed.**

This ADR originally named `zod-to-json-schema` for consumer 3. On implementation, the
installed Zod resolves to **v4.4.3**, and `zod-to-json-schema` is unmaintained and does
not support v4 schemas — its own maintainers direct users to Zod's first-party
`z.toJSONSchema()`.

Consumer 3 is therefore implemented with native `z.toJSONSchema()`. The
`zod-to-json-schema` dependency is removed.

The alternatives were considered and rejected for the same reason the ADR exists:
- *Pin Zod to v3.25* — locks the project to an older major to preserve an unmaintained
  package.
- *Write v4 schemas and re-declare them via the `zod/v3` shim for tool schemas* — defines
  every entity twice, which is the exact failure mode this ADR prevents.

**Verify on implementation:** Anthropic's tool-use `input_schema` expects a JSON Schema
object with `type: "object"` and `properties` at the root. Confirm what `z.toJSONSchema()`
emits for a representative schema before building the helper around it.

**Rule going forward:** an ADR's *decision* is immutable and reversed only by a superseding
ADR. A factual correction to its *mechanism* is a dated amendment appended here.

## Consequences
- The query layer's tool definitions become nearly free — the primary "write less code" win.
- Structured questions get typed tool composition rather than embedding-and-hoping.
- Existing `types/index.ts` interfaces are **not** backfilled as a project. Convert
  opportunistically when a route is touched for other reasons.

## Alternatives rejected
- **Generate types from the database** (`supabase gen types`). Solves shape drift but not
  runtime validation and not tool schemas. Complementary, not a substitute.
