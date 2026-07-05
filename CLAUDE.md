@AGENTS.md

# Dealdesk — Project Intelligence

## Stack
Next.js 16 App Router · React 19 · Supabase (Postgres + RLS) · Clerk auth · Zustand store · Tailwind CSS · TypeScript strict

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

## Key state: `mobileTab` desktop leak
`mobileTab` defaults to `"sheet"` in Zustand and never changes on desktop. Any center panel visibility condition using `mobileTab === "sheet"` will always be true on desktop. Always add explicit `&& centerTab !== "X"` exclusions for every non-sheet center tab.

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
- **Email send integration**: Send LOI directly from the app via email provider (currently records `sent` state but does not deliver email)
