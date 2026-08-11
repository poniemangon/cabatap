-- Run this manually in the Supabase SQL editor.
--
-- Groups: a small persistent circle of players. The group's own `id` IS
-- the join code ("un id del grupo" — no separate invite_code column, unlike
-- duels) — shared via the group page's "Invitar al grupo" link
-- (?group_id=<id>) or typed in manually on the groups dashboard.

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Pivot table: membership.
create table user_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (user_id, group_id)
);

create index user_groups_group_idx on user_groups (group_id);
create index user_groups_user_idx on user_groups (user_id);

alter table groups enable row level security;
alter table user_groups enable row level security;

-- Public read on both — a group's name/photo/roster isn't sensitive, and
-- joining-by-id requires being able to look a group up before confirming.
create policy "groups are viewable by everyone"
  on groups for select
  using (true);

create policy "user_groups are viewable by everyone"
  on user_groups for select
  using (true);

create policy "users can create a group"
  on groups for insert
  with check (
    exists (
      select 1 from profiles p
      where p.id = groups.created_by
        and p.clerk_user_id = requesting_user_id()
    )
  );

-- Joining a group = inserting your own membership row. The creator also
-- gets inserted as a member this same way (client does both inserts), not
-- automatically — no "you're implicitly a member of what you created" rule.
create policy "users can join a group"
  on user_groups for insert
  with check (
    exists (
      select 1 from profiles p
      where p.id = user_groups.user_id
        and p.clerk_user_id = requesting_user_id()
    )
  );
