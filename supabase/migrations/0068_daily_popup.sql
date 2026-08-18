-- Run this manually in the Supabase SQL editor.
--
-- Also fixes ghost_mode's bot visibility (see App-side dailyApi.js/
-- duelApi.js changes): a ghost should be able to see the fake bot
-- opponents on rankings too, just like everyone else can't. That part is
-- pure client-side filtering, no schema change needed — this migration is
-- only the new daily_popups table below.
--
-- A clickable image+link shown before "Mapa del día" — admin manages any
-- number of these (full CRUD), only the most recently created one with
-- active = true is ever shown to players. Two separate images (desktop/
-- mobile) since a promo banner's ideal aspect ratio differs a lot between
-- the two.

create table daily_popups (
  id uuid primary key default gen_random_uuid(),
  image_url_desktop text not null,
  image_url_mobile text not null,
  link_url text not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table daily_popups enable row level security;

create policy "daily popups are viewable by everyone"
  on daily_popups for select
  using (true);

create policy "admins can manage daily popups"
  on daily_popups for all
  using (is_admin_user())
  with check (is_admin_user());
