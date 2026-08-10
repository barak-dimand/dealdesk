-- Runs automatically after `supabase db reset` (see [db.seed] in config.toml).
-- Real operator data, not demo data — this is the actual single-operator
-- workspace (BUILD.md: "Single operator, currently the only user") and the
-- four real owning entities (BUILD.md §1), not a fixture. Written idempotently
-- (on conflict do nothing) so re-running a reset is always safe.

insert into workspaces (name, owner_clerk_id)
values ('My Workspace', 'user_3FbBQz7u95leGZ7Xkzl5MlbmHYa')
on conflict (owner_clerk_id) do nothing;

insert into workspace_members (workspace_id, clerk_user_id, role)
select id, owner_clerk_id, 'owner'
from workspaces
where owner_clerk_id = 'user_3FbBQz7u95leGZ7Xkzl5MlbmHYa'
on conflict (workspace_id, clerk_user_id) do nothing;

-- The four owning entities (ADR-0006, BUILD.md §1).
insert into entities (workspace_id, name, entity_type, formation_state, status)
select w.id, e.name, e.entity_type, e.formation_state, e.status
from workspaces w
cross join (
  values
    ('Easy Breezy LLC',              'llc',      'PA', 'active'),
    ('Imagine Investments LLC',      'llc',      'PA', 'active'),
    ('Everest Realty Solutions LLC', 'llc',      'OH', 'winding_down'),
    ('Personal',                     'personal', null, 'active')
) as e(name, entity_type, formation_state, status)
where w.owner_clerk_id = 'user_3FbBQz7u95leGZ7Xkzl5MlbmHYa'
on conflict (workspace_id, name) do nothing;
