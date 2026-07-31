-- Run this manually in the Supabase SQL editor.
--
-- Generic key/value config table for admin-tunable values that used to be
-- hardcoded client constants — starting with the timed-duel per-round time
-- limit (previously the DUEL_TIME_LIMIT constant in App.jsx). Publicly
-- readable, since the game client needs it on load same as barrios/
-- intersections; writable only from an admin session via is_admin_user()
-- (added in 0016_admin_duels_read.sql).

create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

create policy "settings are viewable by everyone"
  on app_settings for select
  using (true);

create policy "admins can update settings"
  on app_settings for update
  using (is_admin_user())
  with check (is_admin_user());

insert into app_settings (key, value) values ('duel_time_limit_seconds', '8'::jsonb);
