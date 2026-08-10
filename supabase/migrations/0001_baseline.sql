-- Baseline, generated from live introspection of the Supabase project
-- (yhhvikxksyzwveipwcvm) on 2026-08-10 — not copied from schema.sql.
--
-- `supabase db dump` requires Docker (it shells out to a Dockerized pg_dump),
-- which this environment intentionally does not have. This file was built
-- instead from mcp__supabase__list_tables (verbose) plus direct queries
-- against pg_policies, pg_extension, and pg_constraint on the live database,
-- so every column, default, nullability, foreign key, ON DELETE rule, and RLS
-- policy below reflects the actual live schema, not what schema.sql claims it
-- to be. See docs/journal/2026-08-10.md for the comparison against schema.sql.
--
-- The live database also has its own migration history
-- (supabase_migrations.schema_migrations) with six entries — initial_schema,
-- loi_builder, recommendation_rebuild, chat_command_center,
-- platform_restructure_portfolio_crm_buyers, data_provenance — none of whose
-- source files exist in this repository. This baseline was intentionally NOT
-- reconciled against that remote history table (no `migration repair` calls);
-- it only guarantees that applying it to an empty database reproduces the
-- live schema.

create extension if not exists "pgcrypto";

-- ============================================================
-- RLS POLICIES ARE INTENTIONALLY INERT (ADR-0004)
--
-- Every route uses createAdminClient() with SUPABASE_SERVICE_ROLE_KEY, which
-- bypasses RLS entirely. The policies below do not enforce anything today.
-- They are kept, not deleted, so a future session doesn't "restore security"
-- by re-adding policies that still won't fire while the service-role client
-- is in use. Actual authorization lives at the application boundary in
-- src/lib/auth/withWorkspace.ts. See ADR-0004 before touching this.
-- ============================================================

-- ============================================================
-- WORKSPACES (multi-tenant foundation)
-- ============================================================
create table if not exists workspaces (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  owner_clerk_id text not null unique,
  created_at     timestamptz default now()
);

alter table workspaces enable row level security;

create policy "Users can manage their own workspace"
  on workspaces for all
  using (owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub')
  with check (owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub');

-- ============================================================
-- DEALS
-- ============================================================
create table if not exists deals (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid references workspaces(id) on delete cascade not null,
  name           text not null,
  address        text,
  city           text,
  state          text,
  deal_type      text not null default 'multifamily',
  status         text not null default 'analyzing',
  asking_price   bigint,
  unit_count     integer,
  sqft           integer,
  year_built     integer,
  description    text,
  parsed_at      timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  loi_state      text not null default 'none',
  loi_sent_at    timestamptz,
  contact_name   text,
  contact_email  text
);

alter table deals enable row level security;

create policy "Workspace members can manage deals"
  on deals for all
  using (
    workspace_id in (
      select id from workspaces
      where owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL DOCUMENTS
-- ============================================================
create table if not exists deal_documents (
  id                    uuid primary key default gen_random_uuid(),
  deal_id               uuid references deals(id) on delete cascade not null,
  name                  text not null,
  file_type             text not null default 'txt',
  storage_path          text,
  file_size             bigint,
  raw_text              text,
  status                text not null default 'pending',
  parse_error           text,
  parsed_at             timestamptz,
  created_at            timestamptz default now(),
  document_type         text,
  parse_confidence      text,
  parse_warnings        jsonb default '[]'::jsonb,
  extracted_unit_count  integer,
  extracted_field_count integer
);

alter table deal_documents enable row level security;

create policy "Deal document access follows deal access"
  on deal_documents for all
  using (
    deal_id in (
      select d.id from deals d join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL DATA FIELDS
-- ============================================================
create table if not exists deal_data_fields (
  id                    uuid primary key default gen_random_uuid(),
  deal_id               uuid references deals(id) on delete cascade not null,
  document_id           uuid references deal_documents(id) on delete set null,
  category              text not null,
  field_key             text not null,
  field_label           text not null,
  field_value           text,
  field_value_numeric   numeric,
  field_period          text,
  is_verified           boolean default false,
  ai_confidence         numeric,
  ai_note               text,
  sort_order            integer default 0,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  source_type           text not null default 'ai_parsed',
  source_document_id    uuid references deal_documents(id) on delete set null,
  source_text_snippet   text,
  source_confidence     text,
  last_edited_by        text,
  last_edited_at        timestamptz,
  value_history         jsonb not null default '[]'::jsonb,
  user_verified          boolean not null default false
);

alter table deal_data_fields enable row level security;

create policy "Deal data field access follows deal access"
  on deal_data_fields for all
  using (
    deal_id in (
      select d.id from deals d join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL UNITS
-- ============================================================
create table if not exists deal_units (
  id                   uuid primary key default gen_random_uuid(),
  deal_id              uuid references deals(id) on delete cascade not null,
  document_id          uuid references deal_documents(id) on delete set null,
  unit_number          text not null,
  unit_type            text,
  bedrooms             integer,
  bathrooms            numeric,
  sqft                 integer,
  current_rent         bigint,
  market_rent          bigint,
  status               text default 'occupied',
  lease_start          date,
  lease_end            date,
  tenant_notes         text,
  is_verified          boolean default false,
  sort_order           integer default 0,
  created_at           timestamptz default now(),
  source_type          text not null default 'ai_parsed',
  source_document_id   uuid references deal_documents(id) on delete set null,
  source_text_snippet  text,
  source_confidence    text,
  last_edited_by       text,
  last_edited_at       timestamptz,
  value_history        jsonb not null default '[]'::jsonb,
  user_verified        boolean not null default false
);

alter table deal_units enable row level security;

create policy "Deal unit access follows deal access"
  on deal_units for all
  using (
    deal_id in (
      select d.id from deals d join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL MESSAGES
-- ============================================================
create table if not exists deal_messages (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid references deals(id) on delete cascade not null,
  role        text not null,
  content     text not null,
  created_at  timestamptz default now()
);

alter table deal_messages enable row level security;

create policy "Deal message access follows deal access"
  on deal_messages for all
  using (
    deal_id in (
      select d.id from deals d join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL NOTES
-- ============================================================
create table if not exists deal_notes (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid references deals(id) on delete cascade not null unique,
  content     text,
  updated_at  timestamptz default now()
);

alter table deal_notes enable row level security;

create policy "Deal note access follows deal access"
  on deal_notes for all
  using (
    deal_id in (
      select d.id from deals d join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL OFFER STRUCTURES
-- ============================================================
create table if not exists deal_offer_structures (
  id                          uuid primary key default gen_random_uuid(),
  deal_id                     uuid references deals(id) on delete cascade not null,
  structure_type              text not null,
  name                        text not null,
  purchase_price              bigint,
  down_payment                bigint,
  financed_amount             bigint,
  interest_rate               numeric,
  term_years                  integer,
  amortization_years          integer,
  payment_frequency           text default 'monthly',
  first_payment_defer_months  integer default 0,
  balloon_years               integer,
  has_balloon                 boolean default false,
  prepay_penalty              boolean default false,
  annual_debt_service         bigint,
  monthly_payment             bigint,
  cash_to_close               bigint,
  projected_noi                bigint,
  net_cash_flow               bigint,
  dscr                        numeric,
  cap_rate                    numeric,
  is_recommended               boolean default false,
  ai_confidence                numeric,
  ai_reasoning                 text,
  notes                        text,
  created_at                   timestamptz default now()
);

alter table deal_offer_structures enable row level security;

create policy "Deal offer structure access follows deal access"
  on deal_offer_structures for all
  using (
    deal_id in (
      select d.id from deals d join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL RECOMMENDATIONS
-- ============================================================
create table if not exists deal_recommendations (
  id                   uuid primary key default gen_random_uuid(),
  deal_id              uuid references deals(id) on delete cascade not null,
  recommended_move     text,
  confidence           numeric,
  risk_flags           jsonb,
  documents_needed     jsonb,
  cap_rate_scenarios   jsonb,
  created_at           timestamptz default now(),
  tier                 text,
  verdict              text,
  verdict_detail       text,
  at_asking_price      jsonb,
  scenarios            jsonb default '[]'::jsonb,
  appreciation_case    text,
  market_context       text,
  generated_at         timestamptz
);

alter table deal_recommendations enable row level security;

create policy "Deal recommendation access follows deal access"
  on deal_recommendations for all
  using (
    deal_id in (
      select d.id from deals d join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL LOI
-- ============================================================
create table if not exists deal_loi (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references deals(id) on delete cascade not null unique,
  terms         jsonb not null default '[]'::jsonb,
  sections      jsonb not null default '[]'::jsonb,
  generated_at  timestamptz,
  sent_at       timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table deal_loi enable row level security;

create policy "Deal LOI access follows deal access"
  on deal_loi for all
  using (
    deal_id in (
      select d.id from deals d join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL LOI SNAPSHOTS
-- ============================================================
create table if not exists deal_loi_snapshots (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid references deals(id) on delete cascade not null,
  loi_id      uuid references deal_loi(id) on delete cascade not null,
  version     integer not null default 1,
  terms       jsonb not null default '[]'::jsonb,
  sections    jsonb not null default '[]'::jsonb,
  sent_at     timestamptz not null default now(),
  created_at  timestamptz default now()
);

alter table deal_loi_snapshots enable row level security;

create policy "Deal LOI snapshot access follows deal access"
  on deal_loi_snapshots for all
  using (
    deal_id in (
      select d.id from deals d join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL LOI VERSIONS
-- ============================================================
create table if not exists deal_loi_versions (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid references deals(id) on delete cascade not null,
  version_number  integer not null default 1,
  label           text not null default 'v1',
  source          text not null default 'ai_generated',
  sections        jsonb not null default '[]'::jsonb,
  terms           jsonb not null default '[]'::jsonb,
  loi_state       text not null default 'draft',
  sent_at         timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table deal_loi_versions enable row level security;

create policy "LOI versions access follows deal access"
  on deal_loi_versions for all
  using (
    deal_id in (
      select d.id from deals d join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL CHAT PROPOSALS
-- ============================================================
create table if not exists deal_chat_proposals (
  id                   uuid primary key default gen_random_uuid(),
  deal_id              uuid references deals(id) on delete cascade not null,
  message_id           text not null,
  changes              jsonb not null default '[]'::jsonb,
  status               text not null default 'pending',
  applied_change_ids   jsonb not null default '[]'::jsonb,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

alter table deal_chat_proposals enable row level security;

create policy "Proposals access follows deal access"
  on deal_chat_proposals for all
  using (
    deal_id in (
      select d.id from deals d join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- PORTFOLIO ASSETS
-- ============================================================
create table if not exists portfolio_assets (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references workspaces(id) on delete cascade not null,
  origin_deal_id  uuid references deals(id) on delete set null,
  name            text not null,
  address         text,
  city            text,
  state           text,
  asset_class     text not null default 'multifamily',
  status          text not null default 'active',
  purchase_price  bigint,
  purchase_date   date,
  current_value   bigint,
  unit_count      integer,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table portfolio_assets enable row level security;

create policy "Portfolio access follows workspace"
  on portfolio_assets for all
  using (
    workspace_id in (
      select id from workspaces
      where owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- CRM CONTACTS
-- ============================================================
create table if not exists crm_contacts (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid references workspaces(id) on delete cascade not null,
  full_name           text not null,
  email               text,
  phone               text,
  company             text,
  tags                text[] not null default '{}'::text[],
  notes               text,
  last_contacted_at   timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table crm_contacts enable row level security;

create policy "CRM access follows workspace"
  on crm_contacts for all
  using (
    workspace_id in (
      select id from workspaces
      where owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- BUYERS
-- ============================================================
create table if not exists buyers (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid references workspaces(id) on delete cascade not null,
  full_name           text not null,
  email               text,
  phone               text,
  company             text,
  buy_box             jsonb not null default '{}'::jsonb,
  notes               text,
  deals_sent          integer not null default 0,
  last_contacted_at   timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table buyers enable row level security;

create policy "Buyers access follows workspace"
  on buyers for all
  using (
    workspace_id in (
      select id from workspaces
      where owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- HELPER FUNCTION + TRIGGERS: auto-update updated_at
--
-- schema.sql also declared a `deal_loi_updated_at` trigger — it was never
-- actually applied live. Only these two exist. Not included here; if it's
-- wanted, it needs its own migration.
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger deals_updated_at
  before update on deals
  for each row execute procedure update_updated_at();

create trigger deal_data_fields_updated_at
  before update on deal_data_fields
  for each row execute procedure update_updated_at();
