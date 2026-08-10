# Deal Desk — Property Operations Module

**Status:** Draft v0.1 — for review, not yet implementation-ready
**Owner:** Barak
**Scope:** Extends the existing Deal Desk acquisitions product into ongoing portfolio operations.

---

## 0. How to use this document

This is the root planning document. It states *what we are building and why*, and the
constraints that must hold. It does not contain implementation detail — that lives in
per-phase specs (`docs/phases/`) and per-domain `CLAUDE.md` files.

Decisions made here are recorded permanently in `docs/decisions/` as ADRs. If a future
session wants to reverse one, it writes a superseding ADR rather than silently changing
course. **Claude Code should read this file plus the relevant domain `CLAUDE.md` before
any work, and should not re-litigate an ADR without being asked.**

---

## 1. Context

### The operator
Out-of-state owner of ~20 units in Pennsylvania, managed by a small local management
company (Doug, plus assistant Chris). Single operator, currently the only user. Goal is
to scale while staying lean on operations.

### Current state of the world
Portfolio data lives across: multiple Google Drives (one per LLC Gmail), several Google
Sheets (one per LLC, plus a rent roll tab), iMessage threads with Doug and contractors,
email, WhatsApp photos of mail, bank statements across three accounts, QuickBooks
invoices, a Section 8 portal, city portals, and Buildium (recently adopted, not yet
onboarded). Follow-ups live in the operator's head.

### The four owning entities
| Entity | Bank | Notes |
|---|---|---|
| Easy Breezy LLC | Capital One | Majority of units |
| Imagine Investments LLC | Chase | 50/50 partner |
| Everest Realty Solutions LLC | *(used Easy Breezy's account)* | **Winding down** — 1002 Webster sold 2026-08. $50k investor contribution needs settlement; historical inter-entity balance remains |
| Personal | Capital One | One property, DSCR loan (debited from Easy Breezy) |

This commingling is real and must be *representable*, not hidden. It persists in history
even where it stops going forward.

---

## 2. Problem statement, ranked by actual pain

Ranked by the operator's own account of what drains energy and creates anxiety — which
differs from the intuitive feature ranking.

1. **No financial truth.** Rent arrives in aggregate, lagged bank deposits ($2,700 = three
   $900 rents, unlabeled). Money orders post weeks or months after collection. Doug's
   spreadsheet is the only claim record and is updated when he has time. Validation today
   is comparing two totals and hoping. The operator avoids looking at it.
2. **No performance visibility.** Capital expenses (furnace, roof) are mixed with operating
   expenses, so every return figure is wrong in a way that feels right. Loan principal and
   interest are not separated. "Is this portfolio actually good?" has no answer.
3. **No lease or renewal awareness.** Leases live with Doug. Section 8 rent increases
   require 60 days' notice and get missed. Negotiated six-month increase delays get
   forgotten. Month-to-month conversions are invisible.
4. **No follow-up memory.** Repairs, inspections, citations, insurance renewals, and open
   questions are tracked by recollection. Information is lost in iMessage.
5. **No decision support.** The operator wants to be presented with options and computed
   consequences, then decide — not to assemble context from scratch each time.

---

## 3. Guiding principles

Each principle states what it *forbids*, because that is what makes it enforceable.

### P1 — Absence and staleness are first-class states, not nulls
Every externally-sourced fact carries: when we learned it, from whom, and how stale it may
get before it becomes a follow-up.

*Forbids:* returning a confident answer that silently omits unknown data. "Three units are
due for an increase" is wrong if five more can't be evaluated. The correct answer names
the gap and offers to close it.

*Rationale:* This operator's data acquisition is pull-based and human-mediated. The
system's primary job is not storing what he knows — it is knowing precisely what he
doesn't, and generating the ask.

### P2 — AI proposes; humans promote; the ledger records
Extraction and assessment emit `extraction_proposals` with confidence and a provenance
pointer to the exact source document. A promotion step commits them.

*Forbids:* any LLM call writing directly to a domain table.

*Rationale:* This is the only thing that makes the ledger trustworthy enough to query. It
also already exists in this codebase as `deal_chat_proposals` — we generalize, not invent.

### P3 — Provenance is mandatory on every asserted fact
`source_type`, `source_document_id`, `source_text_snippet`, `source_confidence`,
`as_of`, `asserted_by`, `value_history`.

*Forbids:* a value in the system that can't answer "where did this come from and who said so."

*Rationale:* Already the established pattern (`deal_data_fields`). Extending it is free;
abandoning it in a new module would create two classes of data.

### P4 — One schema, three consumers
A Zod schema per entity generates: the TypeScript type, the API boundary validation, and
the Anthropic tool-use JSON schema.

*Forbids:* hand-writing a type that mirrors a table, and hand-writing a tool definition.

*Rationale:* Directly serves "least code." Today an entity's shape is defined three times
(SQL, `types/index.ts`, the literal passed to `.insert()`) with no enforced link.

### P5 — Structured questions get structured tools, not RAG
"When does insurance on X expire" is answered by a typed query function the model composes.
Vector search is reserved for genuine unstructured recall ("find the email where the city
said it was abated").

*Forbids:* embedding the ledger and hoping.

### P6 — Every query tool takes a scope argument
Even while the only scope is "everything."

*Forbids:* tools that assume the caller is the owner.

*Rationale:* Doug and the 50/50 partner get access eventually. Retrofitting scope means
auditing every tool for leaks.

### P8 — External identifiers over inference
Where a counterparty stamps a reference (Buildium `CC-0802-BA6D4`, Farmers policy ref
`5509955`, City of Farrell account `...8924`, Mercer County payment no. `6661`), that
reference is the join key. Attribution by amount, date, or address similarity is a
fallback that must be confirmed, never a default.

*Forbids:* fuzzy address matching that writes without confirmation.

*Rationale:* The portfolio contains 376 Cedar, 380 Cedar, 344 Cedar Ave, and 173 Cedar Ave
(the entity's own registered address). Also 431 Elm / 7682 Elm, and 52 Shenango /
121 Shenango. Similarity scoring will mis-attribute money silently.

### P7 — Doug's interface is his inbox
Where a workflow needs the manager, the system drafts an email/message for operator
approval and parses the reply through intake.

*Forbids:* building features that require a third party to adopt new software.

---

## 4. What we inherit from the existing codebase

### Reuse (do not rebuild)
- **Document extraction pipeline** — `extractText.ts` → `parseDocument.ts` → vision path
  for images → confidence bucketing → `ParseReviewModal` → signed URLs. Roughly 70% of
  intake already exists; it is pointed at the wrong parent.
- **Provenance model** — `deal_data_fields` columns, generalized.
- **Proposal/promotion model** — `deal_chat_proposals`, generalized.
- **Money-as-cents convention** (`bigint`, `formatCentsFull()`).
- **Spreadsheet engine** — TanStack Table + Virtual, for ledger and rent roll views.
- **Test fixture discipline** — centralized fixtures, no inline invented data.

### Fix before building (Phase 0)
| Gap | Consequence if unfixed |
|---|---|
| No migration tool | 12+ new tables appended by hand to a 531-line file, pasted into a web SQL editor, no rollback, no drift detection |
| No runtime validation | Every new route hand-rolls `?? null` coercion; no tool schemas for the query layer |
| `getWorkspaceId()` copied per route | Security is "did I remember the filter" across a doubling route count |
| RLS present but inert | Policies look correct and enforce nothing (service-role client bypasses them) |
| `workspaces.owner_clerk_id` unique | Hard 1:1 lock; blocks any future scoped access |
| Five separate `new Anthropic()` sites, models inline | Model changes require a grep |

### Known gaps to verify, not assume
- `CLAUDE.md` claims Resend "doesn't deliver" while `sendLOI.ts` appears wired. Confirm.
- `ai` (Vercel AI SDK) is a dependency but unused. Remove or adopt deliberately.
- Middleware is `src/proxy.ts`, not `middleware.ts` (Next 16). Preserve.
- Per `AGENTS.md`: Next 16 differs from training data. Read `node_modules/next/dist/docs/`.

---

## 5. Domain model

### The spine
```
workspace
└── entity (LLC / personal)
    ├── bank_account
    └── property                    ← canonical building, new
        └── unit                    ← owned unit, distinct from deal_units
            └── lease
                └── lease_party (tenant, housing authority)
```

`deals` gains a nullable `property_id`, populated on close. `portfolio_assets` is backfilled
into `properties` and retired.

**Units are deliberately not unified with `deal_units`.** A `deal_unit` is an assertion
from a seller's rent roll — unverified, possibly inflated, a negotiating input. A `unit` is
an asset under management with a real lease. Same columns, different truth conditions.
(ADR-0003)

### Cross-cutting entities
- **`counterparty`** — management co, contractor, insurer, city, court, housing authority,
  lender, investor, tenant. One table; they all behave identically for correspondence.
  (`crm_contacts` / `buyers` remain acquisition-side; folded in later — ADR-0007.)
- **`document`** — immutable blob + hash + source + extracted text + parse metadata.
  Nullable links to property, unit, lease, deal, counterparty.
- **`extraction_proposal`** — pending structured output awaiting promotion.
- **`obligation`** — discriminated by `kind`: citation, warrant, inspection, insurance_policy,
  utility_account, tax, permit, loan. Carries status, due date, and `details` JSONB
  validated per kind.
- **`follow_up`** — materialized by the daily rule tick. Never hand-created.
- **`decision`** — a fork requiring judgment: context, options with computed consequences,
  chosen option, resulting actions.

### Leases carry their own economics
Lease terms are **not** portfolio or property settings. Comparing the November 2024
template against the executed 52 Shenango lease (signed 2024-11-25), nearly every economic
term differs:

| Term | Template | 52 Shenango |
|---|---|---|
| Late fee | 5% + $5/day, capped 15% | **$45/day, uncapped** |
| Grace period | 5 days | **4 days** |
| Trash | Landlord pays | **Tenant pays** |
| Payment rail | Buildium / RentRedi (contradictory) | RentRedi |
| Grass / lockout fees | Unpriced | $40 / $60 |

- **`lease_terms`** — a structured, per-lease record carrying rent, grace period, late-fee
  formula, NSF fee, ancillary fees, pet and parking terms, payment rail, and
  `template_version` (this document is stamped "November 2024" on every page). Provenance
  points to the source document and page.
- **Utility responsibility is lease-scoped.** Which accounts are the owner's obligation
  depends on the lease in effect and can flip at turnover. `utility_account`
  responsibility therefore joins through the active lease, not the property.
- **Deposit liability ≠ stated deposit.** 52 Shenango states $1,000, but the $500 move-in
  fee deducts from it (Total Due $2,100, not $2,600). Held liability is **$500**; $500 is
  non-refundable fee income. Model `deposit_stated`, `deposit_held`, and
  `fees_offset_at_signing` separately.
- **Move-in balance is a receivable.** 52 Shenango records Total Due $2,100 against Total
  Paid **$0.00** at execution. Whether it was collected is unknown — a knowledge gap (P1),
  not a zero.
- **Renewal is a live obligation.** 52 Shenango runs 2024-12-01 to 2026-11-30 and
  auto-rolls to month-to-month. Expiry is under four months out as of this writing.

**Extraction hazard — checkboxes.** The lead paint disclosure extracts with *both* options
present ("hazards are present" and "landlord has no knowledge"). Checkbox, initial, and
strike-through fields must be flagged low-confidence and are never auto-promoted (ADR-0007).

**Legal flag:** 52 Shenango is a 24-month term reaching two years on 2026-12-01. PA has
escrow and interest requirements for deposits held beyond two years. For the operator's
attorney; this document offers no legal advice.

### Section 8 leases
Validated against 34 Smith Ave (Gwendolyn Lee, term 2025-08-01 to 2026-07-31):

- **The HAP/tenant split is not stated as such anywhere in the lease.** At 34 Smith it
  leaked into the "Amount due at signing" block: Total Due $607.00, Total Paid $188.00,
  summing to the $795.00 contract rent. Those fields mean gross-due and gross-paid on the
  52 Shenango lease. **Same form, same fields, different semantics.** Extraction must never
  assume field meaning; both readings are flagged for confirmation.
- **HAP drifts between recertifications.** 34 Smith: $607 at signing (Jun 2025) → $519 on
  the Mercer County statement (Jul 2026). Contract rent unchanged, so the tenant portion
  rose $188 → $276. HAP amount is therefore a time-series with validity ranges, not a
  lease attribute.
- **Authoritative source for the split is the housing authority statement**, not the lease.

### Lease knowledge states
`no_lease_on_file` is not the only gap. Observed states requiring explicit representation:

| State | Example |
|---|---|
| `unsigned` | 34 Smith — all signature blocks blank, filename marked "Unsigned" |
| `expired_month_to_month` | 34 Smith — term ended 2026-07-31, auto-rolled |
| `expiring_soon` | 52 Shenango — ends 2026-11-30 |
| `terms_uncertain` | 34 Smith — $795 unconfirmed; S8 recert may have reset contract rent |

A lease that is unsigned **and** expired cannot supply a trustworthy contract rent. The
system reports the uncertainty and generates the ask; it does not silently use $795.

### Reconciliation test fixtures
Three real cases — one clean, one short, one uncertain — all derived from documents
already in hand. These are the reconciliation engine's first tests.

| Case | Contract rent | Collected | Verdict |
|---|---|---|---|
| 52 Shenango | $1,100 (signed lease) | $1,100 (fee $88.00 ÷ 8%) | **Paid in full** |
| 1002 Webster 101 | $750 (settlement proration) | $400 (fee $32.00 ÷ 8%) | **$350 short** |
| 34 Smith | $795 (unsigned, expired) | $576 = $519 HAP + $57 tenant | **~$219 short, rent unconfirmed** |

The third case is the important one: it is only visible by joining a lease, a housing
authority statement, and a management invoice. No single document reveals it, which is why
the ledger exists.

### Lifecycle and temporality
Properties and entities are not permanent, and a sold property is not a deleted one.

- **`property.status`** — `active | listed | sold`, plus a **`disposition`** record: sale
  date, price, closing costs, net proceeds. A sold property retains its full ledger.
- **`entity.status`** — `active | winding_down | dissolved`. Dormant entities retain
  history, tax obligations, and unsettled partner balances.
- **Validity ranges on relationships** — property↔entity ownership, management agreements
  and their fee rates, leases. Every one carries `effective_from` / `effective_to`.

*Forbids:* deleting, hiding, or archiving a disposed property; treating a current
relationship as if it always held.

*Rationale:* A sold property is the only source of a **realized** return — purchase, every
dollar in and out, sale price. That is the most credible figure in the portfolio and the
one worth showing investors. Estimates are what everything else produces.

*Precipitating event:* 1002 Webster sold 2026-08; Everest Realty Solutions winding down.
Design absorbed this additively, which is the signal the spine is right.

### Identity and matching
- **`property_alias`** — observed string → property, with who confirmed it and when.
  Populated only by confirmed matches, never auto-created. Handles `643 Spencer` vs
  `643 SPENCER AVE Sharon PA` vs `643 Spencer Ave`.
- **`external_account`** — a counterparty's identifier for one of our things: Buildium
  ledger, Farmers policy ref, City of Farrell utility account, Section 8 tenant. Maps to
  property/unit/lease/obligation. This is what makes bank rows self-attributing (P8).

### Money
- **`ledger_entry`** — property, unit?, **owning_entity**, **paying_entity**,
  bank_account?, amount_cents, direction, category, `external_ref`, and:
  - **Three dates**: `occurred_on` (service performed), `invoiced_on`, `settled_on`
    (money moved). *Worked example: Leera pest control — serviced 4/15/26, paid by the
    manager in June, invoiced to owner 7/31/26.*
  - **Classification**: `operating | capital | financing | deposit_liability | transfer`.
    This is what makes returns honest.
  - **Passthrough flag + markup**: manager-advanced costs rebilled with a fee
    ($168.54 actual → $170.00 billed).
  - `paying_entity ≠ owning_entity` is legal and expected (personal DSCR mortgage debited
    from Easy Breezy; Everest HAP deposited to Easy Breezy). Represented as a transfer with
    a due-from marker. Full intercompany accounting is deferred to Phase 5.
- **`rent_charge`** — what is owed: lease, period, amount, and a **payer** dimension.
  Confirmed against real data:

  | Property | Total | HAP | Tenant |
  |---|---|---|---|
  | 643 Spencer | $1,250 | $1,250 | $0 |
  | 1002 Webster 102 | $825 | $689 | $136 |
  | 34 Smith | $576 | $519 | $57 |

- **`payment_claim`** — someone asserts payment: source, method, claimed date, period.
- **`bank_deposit`** — money actually arrived, with `external_ref`. Often aggregate
  (Mercer County's $2,458 covers three properties across two entities), often lagged.
- **`payment_match`** — many-to-many between claims and deposits, with confidence and status.
- **`management_agreement`** — entity, counterparty, fee rate. Rates differ per entity
  (8% Easy Breezy and Everest, 9% Imagine). Enables monthly verification that
  `fee == rate × collected` — a cheap, high-trust check on the manager's arithmetic.

### The management invoice is three documents
A single Valley Property invoice yields, from one PDF:
1. **Expenses** — management fees, lawn, pest.
2. **Payment claims** — the Rate column is *rent actually collected* per property, since
   the fee is a percentage of it. `557 Lafayette @ $325` against neighbours at $900–1,900
   is a partial collection, not a cheap unit.
3. **Occupancy signal** — a property with a lawn charge but no management fee line
   (`504 Filer`) collected no rent. Vacancy detectable by absence (P1).

**Consequence:** `extraction_proposal` must support N proposals of differing target kinds
from one source document. This also means Phase 2 may not require the manager's
spreadsheet at all — the invoice is a better claim source, because it is a document with a
total that must foot.

**Known extraction hazards in this format:**
- Multi-period lines — `503 Dickons - Paid June(7/1/26) and July(8/1/26)` at $1,900.
- Off-cycle lines — `393 Hembold Way - June` on an otherwise-July invoice.
- Period is embedded in inconsistent free text. Extraction must flag ambiguity, never
  default to the invoice month.

### Security deposits
Modeled as a **liability** with its own lifecycle, never as income. Separately: confirm PA
escrow requirements with counsel — current handling (commingled, sometimes untracked) may
not match them. This document does not give legal advice.

---

## 6. The query layer and the morning brief

Two surfaces, one engine.

**The brief is the default screen.** A generated daily artifact: vacancies, back rent,
open repairs, what's awaited and from whom, decisions needing the operator, and a
performance line. Prioritized by time-sensitivity and dollar impact.

**Chat is the escape hatch** for ad-hoc questions.

Both read from the same set of typed, scoped query tools generated from Zod schemas.
Both are bound by P1: they report what they do not know.

---

## 7. Phase plan

Each phase has a hard exit criterion. A phase is not done until its criterion is
demonstrably true.

### Phase 0 — Hardening (target: 1 day)
Supabase CLI migrations (baseline the existing schema as `0001`), Zod + the schema
convention, `withWorkspace()`, `workspace_members` (one row), shared Anthropic client with
model constants.

**Exit:** a new table can be added, applied, and rolled back by tooling; one new route
exists using Zod + `withWorkspace()` as the reference pattern.

**Not in Phase 0:** cron (ships with the rules engine), backfilling Zod onto the 15
existing deal routes (opportunistic only).

### Phase 1 — Portfolio state
Entities, bank accounts, properties (backfilled), units, leases, counterparties, general
documents table, lease intake, renewal/increase-eligibility tracking, cron + follow-up
rules, first query tools, thin brief.

> **Day one action, before any code:** send Doug the lease request. Collection is
> human-latency-bound and is the longest pole in the project. It runs in parallel.

**Exit:** every unit has a known lease state (including explicit `no_lease_on_file`), and
the system generates the correct Section 8 60-day increase notice reminder unprompted.

### Phase 2 — Rent truth
Property aliases, external accounts, rent charges (with payer split), payment claims,
bank deposits (CSV import), matching engine, management-fee verification, monthly close.

Claim sources in priority order: **management invoice** (best — a document that must foot),
Buildium export, Section 8 confirmation PDF. The manager's spreadsheet is a fallback.

**Exit:** for a given month, the system reports expected / claimed / settled / unmatched
per property, with every discrepancy attributable — replacing the two-totals comparison.
The system independently verifies the manager's fee arithmetic.

### Phase 3 — Expense truth
Ledger entries, invoice intake → proposal → promotion, capital vs. operating classification,
loan amortization, per-property and per-entity returns.

**Exit:** actual cash-on-cash and DSCR per property, with capital expenditure separated,
computed from the ledger rather than estimated.

### Phase 4 — Compliance and decisions
Obligations (citations, warrants, inspections, insurance renewals with premium drift),
decision objects, draft generation.

**Exit:** no compliance item can go stale without becoming a follow-up.

### Phase 5 — Reporting
Per-entity quarterly statements. Partner capital accounts. Investor-facing output as a
generated statement, not a portal.

---

## 8. Not building

- **Tenant portal.** Buildium owns it. Tenants will not use two.
- **Rent payment rails.** Payments, NSF handling, PCI scope. Not our business.
- **Showing scheduling.** Real bottleneck, but requires a prospect-facing surface and is a
  different product.
- **QuickBooks replacement.**
- **Call transcription automation.** GoHighLevel manual is adequate for now.
- **Manager or investor portals** in the portal sense — see P7 and Phase 5.

---

## 9. Open questions and stubs

| Item | Blocking | Resolution path |
|---|---|---|
| Citation / warrant / inspection lifecycles | Phase 4 | Operator to walk through 2–3 real cases end to end |
| Buildium API surface | Phase 2 optimization | Onboard first; CSV export adapter built behind the same port meanwhile |
| PA security deposit escrow rules | Phase 1 modeling | Operator's attorney |
| Is `173 Cedar Ave` a property, or only Easy Breezy's registered address? | Phase 1 backfill | Operator |
| Three Farmers policies (refs 5509955 / 1638132 / 4565067) — which properties? | Phase 4 | Policy PDFs from Drive |
| Three City of Farrell accounts (…8924 / …8882 / …9307) — which properties? | Phase 2 | City portal or a bill |
| Recurring $300 to "The Amnon Haim" — private lender? | Phase 3 | Operator |
| `crm_contacts` / `buyers` → `counterparty` merge | Deferred | ADR-0007 |
| Partner capital accounts | Phase 5 | ADR-0006 |

**Resolved by source documents (2026-08-07):** Section 8 payer split is real and the
arithmetic closes; management invoice Rate column is collected rent; fee rates differ by
entity; external reference IDs exist across all major counterparties.

---

## 10. Working agreement with Claude Code

- **Domain-first structure.** `src/domains/<domain>/` holds schema, state machine, rules,
  and handlers together. Layer-first scatters one concept across six directories and
  destroys the ability to load coherent context.
- **Per-domain `CLAUDE.md`** stating invariants, state machine, and dependencies in and out.
- **ADRs** in `docs/decisions/NNNN-title.md` — numbered, immutable, one decision each.
- **Session journal** in `docs/journal/YYYY-MM-DD.md`, written as part of definition-of-done.
- **Tests before session end**, per existing project rule. Centralized fixtures only.
- **Every schema change is a migration.** No exceptions, no hand-edits to baseline.
