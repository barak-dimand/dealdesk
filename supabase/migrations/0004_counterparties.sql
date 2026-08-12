-- PHASE-1 Task 1: counterparties and documents are the foundation with no
-- dependencies — everything after references them. One table for every kind
-- of correspondent (management co, contractor, insurer, city, court, housing
-- authority, lender, investor, tenant, title agent, broker, utility, buyer,
-- seller) — they all behave identically for correspondence (BUILD.md §5).
-- `crm_contacts` / `buyers` remain acquisition-side; not merged this phase
-- (ADR-0007 deferral stands).
--
-- `kind` is validated at the Zod boundary (src/domains/counterparties/schema.ts),
-- not with a DB check constraint — matches the existing entities/status convention.

create table if not exists counterparties (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  name         text not null,
  kind         text not null,
  email        text,
  phone        text,
  address      text,
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- RLS is intentionally inert (ADR-0004) — see the note at the top of the RLS
-- section in 0001_baseline.sql. Real isolation is withWorkspace().
alter table counterparties enable row level security;

create policy "Workspace members can manage their workspace's counterparties"
  on counterparties for all
  using (
    workspace_id in (
      select workspace_id from workspace_members
      where clerk_user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );
