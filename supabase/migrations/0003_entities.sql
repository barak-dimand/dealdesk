-- ADR-0006: entity layer now, partner capital deferred. First table of the
-- operations domain spine (BUILD.md §5): workspace -> entity -> ... Bank
-- accounts belong here too per ADR-0006, but are out of scope for the
-- PHASE-0 reference route and land with the rest of Phase 1 portfolio state.

create table if not exists entities (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references workspaces(id) on delete cascade not null,
  name            text not null,
  entity_type     text not null default 'llc', -- 'llc' | 'personal'
  formation_state text,                        -- USPS 2-letter code; null for personal
  status          text not null default 'active', -- 'active' | 'winding_down' | 'dissolved'
  created_at      timestamptz default now(),
  unique (workspace_id, name)
);

-- RLS is intentionally inert here too (ADR-0004) — see the note at the top of
-- the RLS section in 0001_baseline.sql. Kept for documentation parity, not
-- enforcement; the service-role client bypasses this. Real isolation is
-- withWorkspace() at the application boundary.
alter table entities enable row level security;

create policy "Workspace members can manage their workspace's entities"
  on entities for all
  using (
    workspace_id in (
      select workspace_id from workspace_members
      where clerk_user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );
