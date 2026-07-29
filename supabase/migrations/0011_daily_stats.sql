-- Run after 0010_duel_forfeit.sql, in the Supabase SQL editor.
--
-- The daily challenge result never persisted anywhere before this — only
-- sessionStorage, gone as soon as you clear it or switch devices. This
-- saves each signed-in player's daily attempt (one per calendar day, keyed
-- by day_number — the same integer indicesForDay()/dayNumberForDate() use
-- client-side) so it shows up on their profile.

create table daily_stats (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  day_number int not null,
  results jsonb not null,
  total_score int not null,
  completed_at timestamptz not null default now(),
  unique (profile_id, day_number)
);

create index daily_stats_profile_idx on daily_stats (profile_id, day_number desc);

alter table daily_stats enable row level security;

create policy "users can view their own daily stats"
  on daily_stats for select
  using (
    exists (
      select 1 from profiles p
      where p.id = daily_stats.profile_id
        and p.clerk_user_id = requesting_user_id()
    )
  );

create policy "users can save their own daily stats"
  on daily_stats for insert
  with check (
    exists (
      select 1 from profiles p
      where p.id = daily_stats.profile_id
        and p.clerk_user_id = requesting_user_id()
    )
  );

create policy "users can update their own daily stats"
  on daily_stats for update
  using (
    exists (
      select 1 from profiles p
      where p.id = daily_stats.profile_id
        and p.clerk_user_id = requesting_user_id()
    )
  );
