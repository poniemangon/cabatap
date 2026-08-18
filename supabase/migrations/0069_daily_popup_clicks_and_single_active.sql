-- Run this manually in the Supabase SQL editor.

alter table daily_popups add column click_count int not null default 0;

-- Enforces "at most one active popup" at the DB level regardless of any
-- client bug — a plain unique index can't do this (unique(active) would
-- also block having more than one *inactive* row), a partial one can.
create unique index daily_popups_single_active on daily_popups (active) where active;

-- Admin-only, atomic: deactivates whichever popup was active, then
-- activates this one — two separate UPDATEs inside one transaction, so the
-- unique index above is never briefly violated from the client's
-- perspective.
create or replace function set_active_daily_popup(popup_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_user() then
    raise exception 'not authorized';
  end if;
  update daily_popups set active = false where active;
  update daily_popups set active = true where id = popup_id;
end;
$$;

-- Callable by anyone (no auth required, same trust level as the referral
-- visit counter) — a player clicking the popup's image/link bumps this,
-- bypassing RLS's admin-only update policy since it's the only mutation a
-- regular player is ever allowed to make on this table.
create or replace function increment_daily_popup_click(popup_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update daily_popups set click_count = click_count + 1 where id = popup_id;
$$;
