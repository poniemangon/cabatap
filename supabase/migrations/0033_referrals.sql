-- Run this manually in the Supabase SQL editor.
--
-- Daily-map shares now tag the link with ?referral=<username> (App.jsx's
-- resultShareLink). This tracks how many times each user's referral link
-- gets visited: one row per referring profile, visit_count incremented on
-- every visit that carries their username in the query string.
--
-- No insert/update/delete policy for anon/authenticated on purpose — same
-- pattern as daily_wins (0026) — the only writer is record_referral_visit()
-- below, a SECURITY DEFINER function so it bypasses RLS regardless. Regular
-- visitors need to be able to trigger a count bump without being able to
-- write arbitrary rows into this table directly.

create table referrals (
  user_id uuid primary key references profiles(id) on delete cascade,
  visit_count int not null default 0
);

alter table referrals enable row level security;

create policy "admins can read referrals"
  on referrals for select
  using (is_admin_user());

create or replace function record_referral_visit(referrer_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  referrer_id uuid;
begin
  select id into referrer_id from profiles where username = referrer_username;
  if referrer_id is null then
    return;
  end if;

  insert into referrals (user_id, visit_count)
  values (referrer_id, 1)
  on conflict (user_id) do update set visit_count = referrals.visit_count + 1;
end;
$$;
