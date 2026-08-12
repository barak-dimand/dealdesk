@AGENTS.md

# Dealdesk — Project Intelligence

## Required reading before any operations-domain work

This project is expanding from acquisitions (deals, LOIs) into ongoing portfolio
operations. Before touching anything under `src/domains/`, or before re-deriving a
decision that might already be settled, read:

- **`docs/BUILD.md`** — the root planning document: problem statement, guiding
  principles (P1–P8), domain model, phase plan.
- **`docs/decisions/`** — numbered ADRs, one decision each. **Do not re-litigate an
  ADR without being explicitly asked to.** If you think one is wrong, say so and wait.
- **`docs/journal/`** — one dated file per working session; what was done, what
  surprised the session, what was deferred. Write one as part of definition-of-done.

## Domain-first structure (new code)

Code for the operations module lives at `src/domains/<domain>/` — schema, handlers,
and (later) state machine and rules colocated per domain, each with its own
`CLAUDE.md` stating invariants and dependencies. Route handlers under
`src/app/api/` stay thin: `withWorkspace()` plus a call into the domain layer. This
does not apply retroactively to the existing deal-acquisition code, which stays
layer-first (`src/lib/ai/`, `src/app/api/deals/...`) — convert opportunistically only
when a file is already being touched for another reason.

## Stack
Next.js 16 App Router · React 19 · Supabase (Postgres + RLS) · Clerk auth · Zustand store · Tailwind CSS · TypeScript strict

## Schema, migrations, and authorization (Phase 0 hardening)

- **Migrations**: `supabase/migrations/` is the source of truth (ADR-0001), applied
  via `npm run db:migrate`. `src/lib/supabase/schema.sql` is **retired and deleted**
  (2026-08-10) — `0001_baseline.sql` was generated directly from live introspection of
  the Supabase project (not copied from schema.sql; `supabase db dump` needs Docker,
  which this environment doesn't have, so it was built from `list_tables`/`pg_policies`/
  `pg_constraint` queries instead). It is therefore true by construction. Two real
  places where schema.sql had drifted from what was actually live: `deals.status`'s
  default was `'evaluating'` in schema.sql vs. actually `'analyzing'`; a
  `deal_loi_updated_at` trigger was declared in schema.sql but never applied. See
  `docs/journal/2026-08-10.md` for the full comparison. **Verified by an actual
  rebuild:** `supabase db reset --linked` (resets the linked remote project itself from
  local migration files — no Docker) applied `0001`→`0002`→`0003` to the live project
  from empty and matched the pre-reset schema/triggers/policies exactly. The live
  database's migration history table had had 6 real CLI-applied migrations predating
  this session with no source files in this repo; the reset overwrote that history with
  exactly the 3 local migrations, so `supabase migration list --linked` now shows local
  and remote in agreement — no reconciliation step was needed once the baseline was
  proven correct. `supabase/seed.sql` recreates the workspace + four entities after any
  future reset. Cost: the reset deleted 8 real accumulated test deals (backed up outside
  the repo, not restored) and orphaned 9 files in the `deal-documents` storage bucket
  (reset only touches the `public` schema) — both disclosed and confirmed with Barak
  before running.
- **Applying a new migration to the live project: `supabase db push --linked` (also
  `npm run db:migrate`) is the standard path** — it applies pending local migration
  files directly, keyed by their filename version (`0004`, `0005`, ...), no Docker
  required. **Do not use the `mcp__supabase__apply_migration` tool for routine
  migrations** — it works (no Docker either), but it records its own
  auto-generated timestamp as the version in the remote history table instead of the
  local filename, which immediately desyncs `supabase migration list --linked` and
  makes a future `db push` refuse to run (`LegacyDbPushMissingLocalError`). This
  happened twice (Phase 0 Task 5, PHASE-1 Task 1) before being settled 2026-08-12 —
  see ADR-0001's third amendment. If `apply_migration` is ever used anyway (e.g. `db
  push` itself is unavailable for some reason), immediately reconcile before the
  session ends:
  `supabase migration repair --status reverted <stray-remote-timestamp...> --linked`
  for the auto-generated entries, then
  `supabase migration repair --status applied <local-version...> --linked` for the
  local files that actually ran — do **not** re-run the SQL, `repair` only edits the
  bookkeeping. Confirm with `supabase db push --linked --dry-run` (should report
  `"upToDate": true` with no pending migrations).
- **Authorization**: every route resolves workspace scope through
  `withWorkspace()` (`src/lib/auth/withWorkspace.ts`), not by hand-rolling
  `getWorkspaceId()`. RLS policies exist but are **intentionally inert** — the
  service-role client bypasses them; see the comment block in `0001_baseline.sql`
  and ADR-0004. `src/app/api/entities/route.ts` is the reference implementation to
  copy for new routes.
- **Entity shape**: one Zod schema per entity generates the TypeScript type, API
  boundary validation, and (for the future query layer) a tool-use JSON schema via
  `z.toJSONSchema()` — see `src/lib/schema/CLAUDE.md` (ADR-0005). Not backfilled onto
  the existing deal routes; opportunistic only.
- **Anthropic client**: import `client` and `MODEL_FAST` / `MODEL_DEEP` from
  `src/lib/ai/client.ts` rather than constructing a new client. Existing call sites
  still hand-parse JSON from text responses — that conversion to tool use is
  deferred to Phase 1's query layer, not done in Phase 0.

## Recommendation → LOI Flow

1. `POST /api/deals/[id]/recommend` → calls `generateRecommendation()` in `src/lib/ai/recommend.ts` → inserts into `deal_recommendations` (JSONB `scenarios` column holds `OfferScenario[]`)
2. Page load fetches recommendation; `hasValidRec` guard: `!!rec.tier && Array.isArray(rec.scenarios) && rec.scenarios.length > 0`
3. User clicks "Generate LOI from [scenario]" or "Use for LOI" on a scenario card → `handleGenerateLOI(scenario)` in `OfferRecommendation.tsx`
4. `handleGenerateLOI` POSTs to `/api/deals/[id]/loi` with body `{ scenario: { purchase_price, down_payment, financed_amount, interest_rate, term_years, first_payment_defer_months, has_balloon, name, structure_type } }` — field mapping: `OfferScenario.first_payment_deferral_months` → body `first_payment_defer_months`
5. LOI route injects the scenario as a synthetic entry in `offerStructures` with `is_recommended: true`, then calls `generateLOI()`
6. `generateLOI()` reads `ctx.offerStructures.find(o => o.is_recommended)` to populate all LOI terms and sections
7. On success: `setLOI`, `setActiveDeal({...deal, loi_state: 'draft'})`, `setCenterTab('loi')`

## Investment Philosophy (recommendation engine)

Constants in `src/lib/ai/recommend.ts`:
- Vacancy: **8%** of gross income
- Maintenance reserve: **$75/unit/month**
- Management fee: **8%** of gross income
- CapEx reserve: **$50/unit/month**

Tier thresholds (cash flow per unit per month, in cents):
- **home_run**: ≥ $200/unit ($20,000 cents)
- **just_right**: $100–$199/unit ($10,000–$19,999 cents)
- **stretch**: $50–$99/unit ($5,000–$9,999 cents)
- **pass**: < $50/unit (< $5,000 cents)

## Scenario IDs and Display Rules

Three scenario IDs the AI must return:
- `home_run` — best case (aggressive structure, strong cash flow)
- `just_right` — recommended scenario; receives filled green "Use for LOI" button
- `walk_away` — baseline at asking price with standard financing

Display rules:
- `scenario.id === "just_right"` → filled accent button, "Recommended" badge
- `scenario.id === "walk_away"` → tier badge ALWAYS overridden to `pass` regardless of AI-assigned tier (walk_away terms produce negative cash flow)
- All other scenarios → outlined ghost button

## Money / units convention
- All monetary values stored as **cents** (bigint in DB, `number` in TS)
- Use `formatCentsFull()` for display; never trust LLM arithmetic for financial metrics

## Tab visibility
Center panel visibility goes through the single `isTabVisible(tab)` helper in `DealView.tsx` (mobile → `mobileTab`, desktop → `centerTab`). Never write raw `centerTab`/`mobileTab` display conditions — the old hand-maintained exclusion lists caused repeated tab-bleed bugs.

## Resizable Deal Intelligence banner
The banner/table split in `SpreadsheetView.tsx` is a draggable vertical split. Height persists to localStorage `dealdesk_banner_height_[dealId]` (per deal; `SpreadsheetBody` is keyed on deal id so the lazy initializer re-hydrates). `bannerMode` derives from height: ≤80 `collapsed`, <200 `peek` (card titles + first item only), ≥200 `expanded`. `DealIntelligenceBanner` is a controlled component — it takes `bannerMode` + `onToggle` props and owns no collapse state; the chevron and the drag handle both set the same pane height.

## Parsing Architecture

**Entry point:** `POST /api/deals/[id]/parse/route.ts`

**Text extraction** (`src/lib/parsers/extractText.ts`):
- PDF → `pdf-parse`
- CSV → `papaparse` (all rows → text)
- XLSX/XLS → `xlsx` (all sheets)
- DOCX → `mammoth` (`extractRawText`) — no `@types/mammoth`; types live in `src/types/mammoth.d.ts`
- DOC → returns user-facing error (binary format, unsupported)
- TXT/EML/pasted_text → raw string
- image → vision path (see below)

**Image handling:** `extractImageWithVision()` in the parse route downloads the file from Supabase Storage (admin client), base64-encodes it, sends to `claude-sonnet-4-6` with vision. MIME type is derived from the file extension via `mimeTypeFromFileName()` — was previously hardcoded `"image/jpeg"`.

**Truncation:** `smartTruncate(text, fileType)` at **90k characters**. CSV/XLSX preserves column headers + first **200 data rows per sheet section** (sections delimited by `"-".repeat(80)` separators inserted by `extractCSV`/`extractXLSX`). All other types are sliced at 90k.

**AI parsing:** `parseDocumentWithAI()` in `src/lib/ai/parseDocument.ts`. Includes file-type-specific `fileTypeHint()` string injected into the system prompt (PDF → OM/P&L/rent roll hints, CSV/XLSX → tabular column hints, EML/pasted_text → informal notes/listing hints, image → OCR error tolerance hints, DOCX → lease/LOI/report hints).

**Confidence:** Claude returns `confidence: 0.0–1.0`. Converted to `"high" | "medium" | "low"` via `confidenceLabel()` (≥0.75 / ≥0.45 / <0.45) before DB storage.

**DB columns on `deal_documents`:** `document_type`, `parse_confidence`, `parse_warnings` (jsonb array), `extracted_unit_count`, `extracted_field_count`. After a successful parse, `deals.unit_count` is also updated by counting all `deal_units` for the deal.

**ParseReviewModal** (`src/components/files/ParseReviewModal.tsx`): Radix Dialog, two-column layout. Left (45%): source text in monospace pre, or fetches signed image URL from `GET /api/deals/[id]/documents/[docId]/url` (120s expiry). Right (55%): warnings callout, units table, income/expense/summary field groups. Bottom bar: Re-parse button + Looks good close. Low confidence shows amber advisory. Opened by clicking any parsed document row in FilesPanel.

**Signed URL endpoint:** `GET /api/deals/[id]/documents/[docId]/url` — generates 120-second signed URL for private Supabase Storage bucket; used only for image display in ParseReviewModal.

**Store:** `setDocuments` accepts `DealDocument[] | ((prev: DealDocument[]) => DealDocument[])` (functional update pattern).

## Testing Infrastructure

**Framework:** Vitest + React Testing Library (jsdom environment). Config in `vitest.config.ts`; global setup in `src/test/setup.ts` (mocks `next/navigation` and `@clerk/nextjs`; imports `@testing-library/jest-dom/vitest` — must use the `/vitest` entry or matcher types won't compile).

**Fixtures:** `src/test/fixtures/` — canonical Calvert Apartments test data (`CALVERT_DEAL`, `CALVERT_UNITS`, `CALVERT_DATA_FIELDS`, `CALVERT_RECOMMENDATION`, `CALVERT_LOI_DRAFT`, `AGGREGATE_ONLY_CSV_CONTENT`, `REAL_RENT_ROLL_CSV_CONTENT`). All tests use these — do not invent new inline deal data.

**Rule: every new feature must have a corresponding test file before the session ends.** Tests live in `__tests__/` next to the code under test; cross-cutting flows go in `src/test/integration/`.

**How to run:** `npm test` (single run), `npm run test:watch`, `npm run test:coverage`.

**Critical path test:** `src/test/integration/loi-flow.test.tsx` — Recommendation → LOI flow (scenario field mapping, store updates, tab switch). If this breaks, the core product flow is broken.

**Testing gotchas:**
- `LOIBuilder` switches states via `display:none`, not unmounting — assert with `toBeVisible()`, never `toBeInTheDocument()`
- `LOIDocument` (tiptap/ProseMirror) must be mocked in jsdom tests
- Zustand store is real in tests — seed with `useDealStore.setState({...})` in `beforeEach`
- `parseDocumentWithAI` returns rents in dollars/month; the parse route converts to cents (×100)
- Mock Anthropic via `vi.hoisted` + `vi.mock("@anthropic-ai/sdk")` (client is instantiated at module load)

**CI:** `.github/workflows/test.yml` runs `npm test` + `npm run build` on every push/PR.

## Known V1 Gaps (future sessions)
- **Session E**: Portfolio space (multi-deal analytics, aggregate views)
- **PDF export**: LOI document → downloadable PDF
- ~~Email send integration~~ **Corrected 2026-08-10**: this was stale. `sendLOIEmail()`
  (`src/lib/email/sendLOI.ts`) is fully wired via Resend and is called from
  `POST /api/deals/[id]/loi` whenever `loi_state` transitions to `"sent"` — it creates
  a version snapshot, attempts real delivery, and surfaces success/failure back to the
  client without blocking the state save. It does not deliver in this dev environment
  only because `RESEND_API_KEY` isn't set locally — that's a config gap, not a missing
  feature.

## Operations module (Phase 0+)
Portfolio operations (leases, rent truth, expense truth, compliance) is a new domain
being layered onto the acquisitions product described above. See "Required reading"
at the top of this file before working in `src/domains/`.
