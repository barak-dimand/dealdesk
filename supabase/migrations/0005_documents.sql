-- PHASE-1 Task 1 / ADR-0009: a new, general-purpose document table separate
-- from `deal_documents`. `deal_documents` is untouched this phase — see
-- ADR-0009 for why two document tables coexist and the intended sunset.
--
-- property_id / unit_id / lease_id are plain nullable uuid columns with no FK
-- constraint yet: those tables don't exist until Phase 1 Tasks 2-4. Add the
-- FK constraints in the migration that creates each target table.

create table if not exists documents (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid references workspaces(id) on delete cascade not null,
  name              text not null,
  file_type         text not null default 'txt',
  storage_path      text,
  file_size         bigint,
  sha256            text not null,
  source            text not null default 'upload', -- upload|email|whatsapp|buildium|portal|settlement|manual
  raw_text          text,
  parse_confidence  text,
  parse_warnings    jsonb default '[]'::jsonb,
  parsed_at         timestamptz,
  property_id       uuid, -- FK added when `properties` lands (Task 2)
  unit_id           uuid, -- FK added when `units` lands (Task 3)
  lease_id          uuid, -- FK added when `leases` lands (Task 4)
  counterparty_id   uuid references counterparties(id) on delete set null,
  deal_id           uuid references deals(id) on delete set null,
  created_at        timestamptz default now(),
  -- The same lease PDF forwarded twice must not become two documents.
  unique (workspace_id, sha256)
);

alter table documents enable row level security;

create policy "Workspace members can manage their workspace's documents"
  on documents for all
  using (
    workspace_id in (
      select workspace_id from workspace_members
      where clerk_user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- Storage bucket, mirroring the existing `deal-documents` config (private,
-- 50MB limit, same allowed MIME types). Created via migration rather than the
-- dashboard — the whole point of ADR-0001 was no more hand-applied state.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,
  array[
    'application/pdf',
    'text/csv',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'image/png',
    'image/jpeg',
    'image/webp',
    'message/rfc822',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;
