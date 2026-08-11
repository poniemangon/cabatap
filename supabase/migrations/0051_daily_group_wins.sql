-- Run this manually in the Supabase SQL editor.
--
-- Per-group version of daily_wins (0026): yesterday's top competitivo
-- (timed) daily_stats score AMONG A GROUP'S OWN MEMBERS gets that group's
-- daily win trophy — same ⭐ DailyWinBadge, just scoped to group_id instead
-- of being a single global winner.

create table daily_group_wins (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  day_number int not null,
  daily_stat_id uuid not null references daily_stats(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, day_number)
);

create index daily_group_wins_group_idx on daily_group_wins (group_id);
create index daily_group_wins_profile_idx on daily_group_wins (profile_id);

alter table daily_group_wins enable row level security;

create policy "daily group wins are viewable by everyone"
  on daily_group_wins for select
  using (true);

-- No insert/update/delete policy for anon/authenticated on purpose — the
-- only writer is award_daily_group_wins() below, SECURITY DEFINER so it
-- bypasses RLS regardless.

-- Same "yesterday, Argentina calendar day" target as award_daily_win()
-- (0026), just looped over every group instead of picking one global
-- winner. A player only competes against their OWN group's members here —
-- ds.profile_id is joined through user_groups scoped to that one group.
create or replace function award_daily_group_wins()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_day int;
  g record;
  winner record;
begin
  target_day := ((now() at time zone 'America/Argentina/Buenos_Aires')::date - 1) - date '2024-01-01';

  for g in select id from groups loop
    winner := null;

    select ds.profile_id, ds.id as daily_stat_id
    into winner
    from daily_stats ds
    join user_groups ug on ug.user_id = ds.profile_id and ug.group_id = g.id
    where ds.day_number = target_day
      and ds.timed
    order by ds.total_score desc, ds.completed_at asc
    limit 1;

    if winner.daily_stat_id is not null then
      insert into daily_group_wins (group_id, profile_id, day_number, daily_stat_id)
      values (g.id, winner.profile_id, target_day, winner.daily_stat_id)
      on conflict (group_id, day_number) do nothing;
    end if;
  end loop;
end;
$$;

-- Same schedule as award-daily-win (0026): 03:00 UTC = 00:00 Argentina.
select cron.schedule(
  'award-daily-group-wins',
  '0 3 * * *',
  $$select award_daily_group_wins()$$
);
