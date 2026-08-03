-- Admin-granted badges shown next to a player's name in the sidebar,
-- rankings, and daily map result pages. Public read (only active ones),
-- admin-only write — there's no in-app UI for players to grant themselves
-- one, only the separate ubicaba-admin panel (is_admin_user(), see
-- migration 0016).
create table distintivos (
  id uuid primary key default gen_random_uuid(),
  user_uuid uuid not null references profiles(id) on delete cascade,
  image_url text not null,
  title text not null,
  text text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index distintivos_user_idx on distintivos (user_uuid);

alter table distintivos enable row level security;

-- Admins see everything (including inactive, for management in
-- ubicaba-admin) via the broader policy below; this one covers regular
-- players, who should only ever see active badges.
create policy "active badges are viewable by everyone"
  on distintivos for select
  using (is_active);

create policy "admins can manage badges"
  on distintivos for all
  using (is_admin_user())
  with check (is_admin_user());
