-- ADR-0004: authorization moves to the application boundary (withWorkspace()),
-- resolved through membership rather than workspaces.owner_clerk_id directly.
-- owner_clerk_id is left in place — existing routes still read it. Its removal
-- is a later, isolated migration once nothing reads it (see PHASE-0 Task 3).

create table if not exists workspace_members (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid references workspaces(id) on delete cascade not null,
  clerk_user_id  text not null,
  role           text not null default 'owner',
  created_at     timestamptz default now(),
  unique (workspace_id, clerk_user_id)
);

-- Backfill: one row per existing workspace, from its current owner_clerk_id.
insert into workspace_members (workspace_id, clerk_user_id, role)
select id, owner_clerk_id, 'owner'
from workspaces
on conflict (workspace_id, clerk_user_id) do nothing;

-- RLS is intentionally inert here too (ADR-0004) — see the note at the top of
-- the RLS section in 0001_baseline.sql. Kept for documentation parity, not
-- enforcement; the service-role client bypasses this.
alter table workspace_members enable row level security;

create policy "Workspace members can view their own membership rows"
  on workspace_members for select
  using (clerk_user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub');
