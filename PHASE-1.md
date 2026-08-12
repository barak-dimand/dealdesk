# Phase 1 — Portfolio State

**Goal:** the system knows what you own, who lives there, on what terms, and — critically —
what it does not know.
**Exit:** every unit has an explicit lease state (including `no_lease_on_file`), and the
system generates the Section 8 60-day increase notice reminder unprompted.
**Depends on:** Phase 0 complete (migrations proven, Zod, `withWorkspace()`, entities live).

> **Run one task per session.** Each ends in a commit and a journal entry. Do not hand
> this whole file to a single session — Phase 0 showed context degrades badly past a few
> hours of work.

> **Read first:** `docs/BUILD.md`, `docs/decisions/`, `AGENTS.md`. Next.js 16 differs from
> training data. Middleware is `src/proxy.ts`. The two-strike rule on environment setup
> applies throughout.

---

## Task 0 — Non-code, blocking

Leases from the property manager. Phase 1's exit criterion cannot be met without them.
Also: the sewer/trash account numbers, and 34 Smith's current contract rent and
recertification date from the Section 8 portal.

Three real leases are already in hand and are the primary fixtures: **52 Shenango**
(signed, market-rate, expiring 2026-11-30), **34 Smith** (unsigned, expired, Section 8),
and the **1002 Webster** settlement statement (disposed property).

---

## Task 1 — Counterparties and documents

Foundation with no dependencies. Both are referenced by everything after.

### `counterparties`
`workspace_id`, `name`, `kind`, `email`, `phone`, `address`, `notes`, timestamps.

`kind` enum: `management_co | contractor | insurer | city | court | housing_authority |
lender | investor | tenant | title_agent | broker | utility | buyer | seller`.

One table for all of them — they behave identically for correspondence (BUILD.md §5).
`crm_contacts` and `buyers` are acquisition-side and are **not** merged this phase
(ADR-0007 deferral stands).

### `documents`
`workspace_id`, `name`, `file_type`, `storage_path`, `file_size`, `sha256`, `source`,
`raw_text`, `parse_confidence`, `parse_warnings`, `parsed_at`, plus **nullable** links:
`property_id`, `unit_id`, `lease_id`, `counterparty_id`, `deal_id`.

- `source` enum: `upload | email | whatsapp | buildium | portal | settlement | manual`.
- `sha256` is required and unique per workspace — the same lease PDF forwarded twice must
  not become two documents.
- New bucket `documents`, private, mirroring the existing `deal-documents` config.
- **`deal_documents` is untouched this phase.** Two document tables coexist temporarily;
  write ADR-0009 recording the duplication and its intended sunset.

**Done when:** both tables exist via migration, both have Zod schemas and routes using
`withWorkspace()`, a document can be uploaded and its `sha256` computed, and a duplicate
upload is rejected. Tests for each.

---

## Task 2 — Properties, ownership, aliases

### `properties`
`workspace_id`, `name`, `address_line1`, `city`, `state`, `postal_code`, `property_type`,
`status`, `year_built`, `purchase_price_cents`, `purchase_date`, `notes`.

`status` enum: `active | listed | sold` (ADR-0002). A sold property is never deleted or
hidden.

### `property_dispositions`
`property_id`, `sale_date`, `sale_price_cents`, `closing_costs_cents`,
`net_proceeds_cents`, `buyer_counterparty_id`, `source_document_id`.

Webster is the first record: sold 2026-07-28, $61,000, net to seller $55,980.71.

### `property_ownership`
`property_id`, `entity_id`, `effective_from`, `effective_to` (nullable = current).

A join table rather than a column on `properties`, because ownership changes and the
history must survive (ADR-0002). Everest owned Webster until 2026-07-28; that fact has to
remain true afterward.

### `property_aliases`
`property_id`, `observed_string`, `normalized_string`, `confirmed_by`, `confirmed_at`,
`source_document_id`. Unique on `(workspace_id, normalized_string)`.

**Populated only by confirmed matches. Never auto-created** (ADR-0008). Seed from strings
already observed: `52 Shenango Blvd`, `34 Smith Ave`, `1002 Webster 101`, `1002.5 Webster`,
`643 SPENCER AVE Sharon PA`.

### Backfill
Roughly 20 units across a handful of buildings, drawn from three Google Sheets and the
Easy Breezy management invoice's 15 line items. **This is a manual afternoon, not a
script.** Produce a CSV, review it, then import.

Watch for: 376 Cedar / 380 Cedar / 344 Cedar Ave / 173 Cedar Ave, 431 Elm / 7682 Elm,
52 Shenango / 121 Shenango. And resolve whether 173 Cedar Ave is a property or only Easy
Breezy's registered address (BUILD.md §9).

**Done when:** every property exists with a current owning entity, Webster is `sold` with a
disposition record, and a lookup of `1002.5 Webster` resolves to the right property through
an alias.

---

## Task 3 — Units

`property_id`, `unit_number` (nullable for single-family), `bedrooms`, `bathrooms`, `sqft`,
`status`, `notes`.

`status` enum: `occupied | vacant | renovating | off_market`.

**Every property gets at least one unit**, including single-family homes. Uniformity means
leases always attach to units and no query needs a special case.

Not unified with `deal_units` (ADR-0003).

**Done when:** every property has its units, and 1002 Webster has both 101 and 102 with
their bed/bath counts from the settlement and lease documents.

---

## Task 4 — Leases

The heart of the phase. Three tables.

### `leases`
`unit_id`, `status`, `lease_type`, `start_date`, `end_date`, `executed_on`,
`template_version`, `payment_rail`, `source_document_id`, plus the shared `knowledge` and
`provenance` blocks from `src/lib/schema/`.

`status` enum — the observed states, not a guess (BUILD.md §5):
`draft | unsigned | active | expiring_soon | expired_month_to_month | terminated`.

`no_lease_on_file` is **not** a lease status. It is the absence of a lease row for a unit,
surfaced by the query layer. Do not create placeholder lease rows.

`payment_rail` enum: `rentredi | buildium | cash | check | money_order | mixed | unknown`.
Per-lease, not portfolio-level — the 52 Shenango lease mandates RentRedi while the current
template says Buildium.

`template_version` is free text taken from the document header (`"November 2024"`,
`"June 2025"`). Terms track template vintage.

### `lease_terms`
One row per lease. Structured, because nearly every economic term varies (BUILD.md §5).

`rent_cents`, `due_day`, `grace_period_days`, `late_fee_kind`, `late_fee_percent`,
`late_fee_daily_cents`, `late_fee_cap_percent`, `nsf_fee_cents`, `deposit_stated_cents`,
`deposit_held_cents`, `fees_offset_at_signing_cents`, `move_in_fee_cents`,
`total_due_at_signing_cents`, `total_paid_at_signing_cents`, `parking_spaces`,
`parking_fee_cents`, `pets_allowed`, `pet_fee_cents`, `utilities_owner_pays`,
`utilities_tenant_pays`, `ancillary_fees` (JSONB — grass, lockout, and the long tail).

`late_fee_kind` enum: `percent_plus_daily | flat_daily | none`. 52 Shenango is
`flat_daily` at $45/day uncapped; the template is `percent_plus_daily` at 5% + $5/day
capped at 15%.

**Deposit modeling.** `deposit_stated_cents` is what the lease says. `deposit_held_cents`
is the actual refundable liability. At 52 Shenango those are $1,000 and **$500** — the
$500 move-in fee deducts from the deposit and is fee income. Recording the stated figure as
a liability overstates it by half.

`utilities_owner_pays` / `utilities_tenant_pays` are text arrays. **Lease-scoped, not
property-scoped** — 52 Shenango has the owner on sewer only; 34 Smith has sewer and trash.

### `lease_parties`
`lease_id`, `counterparty_id`, `role`, `is_primary`.

`role` enum: `tenant | occupant | housing_authority | guarantor | landlord_agent`.

Occupants are often unnamed free text ("Her children") — store what the document says,
don't invent people.

### Section 8
The HAP/tenant split is **not** a lease attribute. It drifts between recertifications:
34 Smith went $607 → $519 while contract rent held at $795. Model it in Phase 2 as a
time-series sourced from housing authority statements. This phase records only that a
lease *is* Section 8 (via a `lease_parties` row with role `housing_authority`) and that
the split is unknown.

**Done when:** all three fixture leases load with correct terms, 52 Shenango shows
`deposit_held_cents = 50000`, 34 Smith shows `unsigned` and `expired_month_to_month`, and
a query for 34 Smith's contract rent returns uncertainty rather than $795.

---

## Task 5 — Lease intake

Document → extraction → proposal → promotion. Reuses the existing pipeline
(`extractText.ts`, `parseDocument.ts`, vision path, `ParseReviewModal`) repointed at
`documents` instead of `deal_documents`.

### `extraction_proposals`
`workspace_id`, `source_document_id`, `target_kind`, `target_id` (null = create new),
`proposed` (JSONB), `confidence`, `field_confidences` (JSONB), `status`, `promoted_at`,
`promoted_by`, `notes`.

`status` enum: `pending | promoted | rejected | superseded`.

**One document yields N proposals of differing kinds** (ADR-0007). A lease PDF produces a
`lease`, a `lease_terms`, one or more `lease_parties`, and possibly a `property` and
`unit`. Generalize `deal_chat_proposals`; do not invent a new mechanism.

### Never auto-promote
- Checkbox, initial, and strike-through fields. The lead paint disclosure extracts with
  *both* options present — no extractor can tell which was checked.
- Anything financial: rent, deposit, fees.
- Signature blocks and execution dates.

Auto-promotion above a confidence threshold is permitted only for descriptive fields
(bedroom count, address, residence type).

### Extraction rules for this document family
- The "Amount due at signing" block has **inconsistent semantics**. On 52 Shenango,
  Total Due is gross and Total Paid is $0.00. On 34 Smith, Total Due $607 and Total Paid
  $188 are the HAP and tenant portions. Emit both readings as competing proposals; never
  pick one silently.
- An unsigned lease is `status: unsigned`, never `active`, regardless of how complete the
  terms are.
- `template_version` comes from the page header.

**Done when:** uploading the 52 Shenango PDF produces the full proposal set, promotion
writes a complete lease with provenance pointing at the source page, and the 34 Smith
signing block produces two competing proposals rather than one confident answer.

---

## Task 6 — Cron and follow-up rules

The first thing that acts without being asked.

### Scheduling
`vercel.json` cron → `POST /api/cron/tick`, authenticated by a shared secret header. One
route, no queue.

### `follow_ups`
`workspace_id`, `rule_id`, `subject_type`, `subject_id`, `title`, `detail`, `due_on`,
`priority`, `status`, `first_generated_at`, `last_evaluated_at`, `snoozed_until`.

`status` enum: `open | snoozed | done | dismissed`.

**Idempotency is the whole problem.** Unique on
`(workspace_id, rule_id, subject_type, subject_id, period_key)`. A daily tick must
re-evaluate without creating duplicates, and must not resurrect something dismissed.

**Never hand-created.** Only the rule tick writes here.

### Rules for Phase 1
| Rule | Fires when | Priority |
|---|---|---|
| `lease_expiring` | Fixed lease ends within 90 days | High |
| `section8_increase_notice` | S8 lease, increase eligible, 60-day deadline within 30 days | **Highest** |
| `lease_unsigned` | Lease has no execution date | Medium |
| `no_lease_on_file` | Unit has no lease row | High |
| `lease_terms_stale` | `as_of` older than `stale_after_days` | Low |
| `month_to_month_no_increase` | On M2M ≥12 months with no rent change | Medium |

Rules are data-driven where practical. Each states its own `period_key` so idempotency is
explicit rather than incidental.

**Done when:** the tick runs on schedule, 52 Shenango generates a `lease_expiring`
follow-up (ends 2026-11-30), 34 Smith generates both `lease_unsigned` and
`month_to_month_no_increase`, and running the tick twice produces no duplicates.

---

## Task 7 — Query tools

Typed functions generated from Zod schemas, composed by the model via Anthropic tool use
(ADR-0005). **Every one takes a `scope` argument** even though scope is always
"everything" today (ADR-0004, BUILD.md P6).

Initial set:
- `listProperties(scope, { status?, entityId? })`
- `getProperty(scope, propertyId)`
- `listUnits(scope, { propertyId?, status? })`
- `getUnitLeaseState(scope, unitId)`
- `listLeasesExpiring(scope, { withinDays })`
- `listUnitsEligibleForIncrease(scope)`
- `listOpenFollowUps(scope, { dueBefore?, priority? })`
- `listKnowledgeGaps(scope)`

`listKnowledgeGaps` is the P1 tool and the most important one. Every other tool's response
envelope carries a `gaps` field alongside its results — a tool that returns three units due
for an increase while five more can't be evaluated must say so in the same response.

**Done when:** "which units are due for a rent increase?" returns a correct list *and*
names the units it could not evaluate and why.

---

## Task 8 — The brief

The default screen. A generated daily artifact, not a chat window.

Sections, ordered by time-sensitivity and dollar impact:
1. **Needs you now** — follow-ups due or overdue, highest priority first
2. **Lease and renewal calendar** — expiring, month-to-month, increase-eligible
3. **What I don't know** — knowledge gaps, with a drafted ask for each
4. **Portfolio at a glance** — units, occupied, vacant, lease states by count

Chat is the escape hatch, reading the same tools.

Drafted asks route through the manager's inbox (BUILD.md P7) — generate the message, the
operator approves and sends. No portal.

**Done when:** the brief renders from real data, states its own gaps honestly, and the
Section 8 notice reminder appears without being asked for.

---

## Explicitly not in Phase 1

| Item | When | Why |
|---|---|---|
| Rent charges, payment claims, bank deposits, matching | Phase 2 | Needs lease state to exist first |
| HAP time-series | Phase 2 | Sourced from housing authority statements, not leases |
| Ledger entries, capital vs. operating, returns | Phase 3 | |
| Obligations (citations, warrants, insurance, utilities) | Phase 4 | Lifecycles still unspecified |
| Decision objects | Phase 4 | |
| Partner capital accounts | Phase 5 | ADR-0006 |
| Merging `deal_documents` into `documents` | Later | ADR-0009 |
| Merging `crm_contacts` / `buyers` into `counterparties` | Later | ADR-0007 |
| Buildium API adapter | Phase 2 | Onboard first |
| Vector search | Later | Structured questions get structured tools (BUILD.md P5) |

---

## Test fixtures

Centralized only, per existing project rule. Three real cases spanning the shape space:

| Fixture | Covers |
|---|---|
| 52 Shenango | Signed, market-rate, flat-daily late fee, deposit offset by move-in fee, expiring soon, RentRedi, owner pays sewer only |
| 34 Smith | Unsigned, expired to month-to-month, Section 8, ambiguous signing block, template late fee, owner pays sewer and trash |
| 1002 Webster | Disposed property, two units, prorated rent, deposit transferred at closing, delinquent sewer |

Do not invent lease data. If a case isn't covered by these three, say so rather than
fabricating a fourth.

---

## Exit criteria

Phase 1 is complete when **all** are true:

1. Every unit has an explicit lease state, including `no_lease_on_file` where true.
2. The system generates the Section 8 60-day increase notice reminder unprompted.
3. `listUnitsEligibleForIncrease` names both what it knows and what it cannot evaluate.
4. Uploading a lease PDF produces proposals requiring promotion — nothing financial is
   written to a domain table by an LLM call.
5. The daily tick is idempotent: running it twice produces no duplicate follow-ups.
6. The brief renders from real portfolio data.
7. `npm test`, `npm run build`, and CI all pass.

---

## Open questions

| Item | Blocking | Resolution path |
|---|---|---|
| Is `173 Cedar Ave` a property or only a registered address? | Task 2 backfill | Operator |
| 34 Smith current contract rent and recert date | Task 4 fixture | Section 8 portal |
| Signed lease for 34 Smith — does one exist? | Task 4 | Property manager |
| Sewer/trash account numbers per property | Task 4 `utilities_owner_pays` | Property manager or city portal |
| Increase eligibility rule — what actually makes a unit eligible? | Task 6 | Operator; likely months since last increase plus lease type |
