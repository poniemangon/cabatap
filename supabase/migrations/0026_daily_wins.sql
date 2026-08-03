-- Run this manually in the Supabase SQL editor.
--
-- daily_wins: one row per day, naming whoever posted the top competitivo
-- (timed) score on "Mapa del día" that day. Links the winning profile, the
-- day_number (same epoch the client uses — see day_number below), and the
-- actual daily_stats row that won, so the winning attempt itself stays
-- traceable.
--
-- day_number must match App.jsx's dayNumberForDate(): EPOCH_UTC =
-- 2024-01-01T00:00:00Z, day_number = floor((utcMidnight(date) - EPOCH_UTC)
-- / 86400000). In SQL that's just `(a_utc_date - date '2024-01-01')`.

create table daily_wins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  day_number int not null unique,
  daily_stat_id uuid not null references daily_stats(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index daily_wins_profile_idx on daily_wins (profile_id);

alter table daily_wins enable row level security;

create policy "daily wins are viewable by everyone"
  on daily_wins for select
  using (true);

-- No insert/update/delete policy for anon/authenticated on purpose — the
-- only writer is award_daily_win() below, which is SECURITY DEFINER and so
-- bypasses RLS regardless. Nobody should ever award themselves a win.

-- Awards yesterday's (Argentina calendar day) top competitivo daily_stats
-- row a daily_win, if one doesn't already exist for that day (the unique
-- constraint on day_number + ON CONFLICT DO NOTHING make this idempotent —
-- safe to run more than once for the same day, e.g. if the cron job
-- retries).
create or replace function award_daily_win()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_day int;
  winner record;
begin
  target_day := ((now() at time zone 'America/Argentina/Buenos_Aires')::date - 1) - date '2024-01-01';

  select ds.profile_id, ds.id as daily_stat_id
  into winner
  from daily_stats ds
  where ds.day_number = target_day
    and ds.timed
  order by ds.total_score desc, ds.completed_at asc
  limit 1;

  if winner.daily_stat_id is not null then
    insert into daily_wins (profile_id, day_number, daily_stat_id)
    values (winner.profile_id, target_day, winner.daily_stat_id)
    on conflict (day_number) do nothing;
  end if;
end;
$$;

-- Requires the pg_cron extension. If this errors with a permissions issue,
-- enable it first via the Supabase dashboard: Database -> Extensions ->
-- pg_cron, then re-run just the two statements below.
create extension if not exists pg_cron;

-- 03:00 UTC = 00:00 Argentina time (America/Argentina/Buenos_Aires, UTC-3,
-- no DST). pg_cron schedules run in UTC. Adjust the "3" if that ever
-- changes. Calling cron.schedule() again with the same job name
-- ("award-daily-win") updates the existing schedule, so re-running this
-- statement is safe even if an earlier version was already scheduled.
select cron.schedule(
  'award-daily-win',
  '0 3 * * *',
  $$select award_daily_win()$$
);
