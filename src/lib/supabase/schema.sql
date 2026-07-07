-- Dealdesk Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- WORKSPACES (multi-tenant foundation)
-- ============================================================
create table if not exists workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_clerk_id text not null unique,
  created_at  timestamptz default now()
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
  id          uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  name        text not null,
  address     text,
  city        text,
  state       text,
  deal_type   text not null default 'multifamily',
  status      text not null default 'evaluating',
  asking_price bigint,   -- stored in cents
  unit_count  int,
  sqft        int,
  year_built  int,
  description text,
  parsed_at   timestamptz,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
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
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid references deals(id) on delete cascade not null,
  name         text not null,
  file_type    text not null default 'txt',
  storage_path text,
  file_size    bigint,
  raw_text     text,
  status       text not null default 'pending',
  parse_error  text,
  parsed_at    timestamptz,
  created_at   timestamptz default now()
);

alter table deal_documents enable row level security;

create policy "Deal document access follows deal access"
  on deal_documents for all
  using (
    deal_id in (
      select d.id from deals d
      join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL DATA FIELDS (normalized extracted data)
-- ============================================================
create table if not exists deal_data_fields (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid references deals(id) on delete cascade not null,
  document_id         uuid references deal_documents(id) on delete set null,
  category            text not null,  -- income, expense, summary, financing, market, unit
  field_key           text not null,
  field_label         text not null,
  field_value         text,
  field_value_numeric numeric,
  field_period        text,           -- monthly, annual, per_unit
  is_verified         boolean default false,
  ai_confidence       numeric,        -- 0.0 to 1.0
  ai_note             text,
  sort_order          int default 0,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table deal_data_fields enable row level security;

create policy "Deal data field access follows deal access"
  on deal_data_fields for all
  using (
    deal_id in (
      select d.id from deals d
      join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL UNITS (rent roll)
-- ============================================================
create table if not exists deal_units (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid references deals(id) on delete cascade not null,
  document_id  uuid references deal_documents(id) on delete set null,
  unit_number  text not null,
  unit_type    text,
  bedrooms     int,
  bathrooms    numeric,
  sqft         int,
  current_rent bigint,   -- cents
  market_rent  bigint,   -- cents
  status       text default 'occupied',
  lease_start  date,
  lease_end    date,
  tenant_notes text,
  is_verified  boolean default false,
  sort_order   int default 0,
  created_at   timestamptz default now()
);

alter table deal_units enable row level security;

create policy "Deal unit access follows deal access"
  on deal_units for all
  using (
    deal_id in (
      select d.id from deals d
      join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL MESSAGES (AI chat history)
-- ============================================================
create table if not exists deal_messages (
  id        uuid primary key default gen_random_uuid(),
  deal_id   uuid references deals(id) on delete cascade not null,
  role      text not null,  -- user, assistant
  content   text not null,
  created_at timestamptz default now()
);

alter table deal_messages enable row level security;

create policy "Deal message access follows deal access"
  on deal_messages for all
  using (
    deal_id in (
      select d.id from deals d
      join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL NOTES (rich text)
-- ============================================================
create table if not exists deal_notes (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid references deals(id) on delete cascade not null unique,
  content    text,
  updated_at timestamptz default now()
);

alter table deal_notes enable row level security;

create policy "Deal note access follows deal access"
  on deal_notes for all
  using (
    deal_id in (
      select d.id from deals d
      join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL OFFER STRUCTURES
-- ============================================================
create table if not exists deal_offer_structures (
  id                        uuid primary key default gen_random_uuid(),
  deal_id                   uuid references deals(id) on delete cascade not null,
  structure_type            text not null,
  name                      text not null,
  purchase_price            bigint,   -- cents
  down_payment              bigint,
  financed_amount           bigint,
  interest_rate             numeric,  -- percent
  term_years                int,
  amortization_years        int,
  payment_frequency         text default 'monthly',
  first_payment_defer_months int default 0,
  balloon_years             int,
  has_balloon               boolean default false,
  prepay_penalty            boolean default false,
  annual_debt_service       bigint,   -- cents
  monthly_payment           bigint,
  cash_to_close             bigint,
  projected_noi             bigint,
  net_cash_flow             bigint,   -- noi minus debt service
  dscr                      numeric,
  cap_rate                  numeric,
  is_recommended            boolean default false,
  ai_confidence             numeric,
  ai_reasoning              text,
  notes                     text,
  created_at                timestamptz default now()
);

alter table deal_offer_structures enable row level security;

create policy "Deal offer structure access follows deal access"
  on deal_offer_structures for all
  using (
    deal_id in (
      select d.id from deals d
      join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- DEAL RECOMMENDATIONS (AI-generated)
-- ============================================================
create table if not exists deal_recommendations (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid references deals(id) on delete cascade not null,
  recommended_move    text,
  confidence          numeric,
  risk_flags          jsonb,
  documents_needed    jsonb,
  cap_rate_scenarios  jsonb,
  created_at          timestamptz default now()
);

alter table deal_recommendations enable row level security;

create policy "Deal recommendation access follows deal access"
  on deal_recommendations for all
  using (
    deal_id in (
      select d.id from deals d
      join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- STORAGE BUCKET (for uploaded documents)
-- ============================================================
-- Run in Supabase dashboard → Storage:
-- Create a bucket named "deal-documents" with:
--   - Public: false
--   - File size limit: 50MB
--   - Allowed MIME types: application/pdf, text/csv, text/plain,
--     application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
--     application/vnd.ms-excel, image/*, message/rfc822

-- ============================================================
-- HELPER FUNCTION: auto-update updated_at
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

-- ============================================================
-- MIGRATION: LOI Builder  (Session B)
-- ============================================================

-- 1. Add LOI columns to deals table
alter table deals add column if not exists loi_state   text not null default 'none';
alter table deals add column if not exists loi_sent_at timestamptz;
alter table deals add column if not exists contact_name  text;
alter table deals add column if not exists contact_email text;

-- 2. LOI document (1:1 with deal)
create table if not exists deal_loi (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid references deals(id) on delete cascade not null unique,
  terms        jsonb not null default '[]',
  sections     jsonb not null default '[]',
  generated_at timestamptz,
  sent_at      timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table deal_loi enable row level security;

create policy "Deal LOI access follows deal access"
  on deal_loi for all
  using (
    deal_id in (
      select d.id from deals d
      join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

create trigger deal_loi_updated_at
  before update on deal_loi
  for each row execute procedure update_updated_at();

-- 3. LOI snapshots (immutable sent copies, versioned)
create table if not exists deal_loi_snapshots (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid references deals(id) on delete cascade not null,
  loi_id     uuid references deal_loi(id) on delete cascade not null,
  version    int not null default 1,
  terms      jsonb not null default '[]',
  sections   jsonb not null default '[]',
  sent_at    timestamptz not null default now(),
  created_at timestamptz default now()
);

alter table deal_loi_snapshots enable row level security;

create policy "Deal LOI snapshot access follows deal access"
  on deal_loi_snapshots for all
  using (
    deal_id in (
      select d.id from deals d
      join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- MIGRATION: Recommendation Rebuild (investment philosophy)
-- ============================================================
alter table deal_recommendations add column if not exists tier text;
alter table deal_recommendations add column if not exists verdict text;
alter table deal_recommendations add column if not exists verdict_detail text;
alter table deal_recommendations add column if not exists at_asking_price jsonb;
alter table deal_recommendations add column if not exists scenarios jsonb default '[]';
alter table deal_recommendations add column if not exists appreciation_case text;
alter table deal_recommendations add column if not exists market_context text;
alter table deal_recommendations add column if not exists generated_at timestamptz;

-- ============================================================
-- MIGRATION: Parsing Overhaul — document parse metadata
-- ============================================================
alter table deal_documents add column if not exists document_type       text;
alter table deal_documents add column if not exists parse_confidence     text;
alter table deal_documents add column if not exists parse_warnings       jsonb default '[]';
alter table deal_documents add column if not exists extracted_unit_count int;
alter table deal_documents add column if not exists extracted_field_count int;

-- ============================================================
-- MIGRATION: Chat Command Center — LOI versions + chat proposals
-- ============================================================
create table if not exists deal_loi_versions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade not null,
  version_number int not null default 1,
  label text not null default 'v1',
  source text not null default 'ai_generated', -- 'chat' | 'ai_generated' | 'manual'
  sections jsonb not null default '[]',
  terms jsonb not null default '[]',
  loi_state text not null default 'draft',
  sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table deal_loi_versions enable row level security;

create policy "LOI versions access follows deal access"
  on deal_loi_versions for all
  using (
    deal_id in (
      select d.id from deals d
      join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id =
        current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

create table if not exists deal_chat_proposals (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade not null,
  message_id text not null,
  changes jsonb not null default '[]',
  status text not null default 'pending',
  applied_change_ids jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table deal_chat_proposals enable row level security;

create policy "Proposals access follows deal access"
  on deal_chat_proposals for all
  using (
    deal_id in (
      select d.id from deals d
      join workspaces w on w.id = d.workspace_id
      where w.owner_clerk_id =
        current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- ============================================================
-- MIGRATION: Platform Restructure — Portfolio, CRM, Buyers
-- ============================================================
create table if not exists portfolio_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  origin_deal_id uuid references deals(id) on delete set null,
  name text not null,
  address text,
  city text,
  state text,
  asset_class text not null default 'multifamily',
  status text not null default 'active',
  purchase_price bigint,
  purchase_date date,
  current_value bigint,
  unit_count int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table portfolio_assets enable row level security;
create policy "Portfolio access follows workspace"
  on portfolio_assets for all
  using (workspace_id in (
    select id from workspaces
    where owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
  ));

create table if not exists crm_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  full_name text not null,
  email text,
  phone text,
  company text,
  tags text[] not null default '{}',
  notes text,
  last_contacted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table crm_contacts enable row level security;
create policy "CRM access follows workspace"
  on crm_contacts for all
  using (workspace_id in (
    select id from workspaces
    where owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
  ));

create table if not exists buyers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  full_name text not null,
  email text,
  phone text,
  company text,
  buy_box jsonb not null default '{}',
  notes text,
  deals_sent int not null default 0,
  last_contacted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table buyers enable row level security;
create policy "Buyers access follows workspace"
  on buyers for all
  using (workspace_id in (
    select id from workspaces
    where owner_clerk_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
  ));
