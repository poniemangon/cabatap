-- Run this manually in the Supabase SQL editor.
--
-- Automated achievements ("logros"), distinct from distintivos (0025):
-- distintivos are one-off badges an admin manually grants to a specific
-- player; logros are catalog entries (title + text + icon + a metric +
-- threshold) that the system grants automatically to any player who meets
-- the requirement, via triggers on the tables that feed each metric.

create table logros (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  text text,
  image_url text,
  metric_type text not null check (
    metric_type in ('daily_maps_completed', 'daily_wins', 'duels_won', 'duels_played', 'elo_top_rank')
  ),
  threshold int not null check (threshold > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Pivot/junction table: one row per (profile, logro) pair earned.
create table logros_jugadores (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  logro_id uuid not null references logros(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (profile_id, logro_id)
);

create index logros_jugadores_profile_idx on logros_jugadores (profile_id);

alter table logros enable row level security;
alter table logros_jugadores enable row level security;

create policy "active logros are viewable by everyone"
  on logros for select
  using (is_active);

create policy "admins can manage logros"
  on logros for all
  using (is_admin_user())
  with check (is_admin_user());

create policy "logros_jugadores are viewable by everyone"
  on logros_jugadores for select
  using (true);

-- No insert/update/delete policy for anon/authenticated on purpose — the
-- only writer is check_and_grant_achievements() below, which is SECURITY
-- DEFINER and so bypasses RLS. Nobody should ever grant themselves a logro.

-- Re-evaluates every active logro's requirement for one player and inserts
-- any newly-met one. ON CONFLICT DO NOTHING makes it safe to call
-- repeatedly (every relevant write re-checks the player, not just the ones
-- that actually unlock something).
create or replace function check_and_grant_achievements(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  daily_maps_count int;
  daily_wins_count int;
  duels_won_count int;
  duels_played_count int;
  my_elo int;
  my_ranked_games int;
  my_elo_rank int;
begin
  select count(*) into daily_maps_count
  from daily_stats
  where profile_id = target_profile_id;

  select count(*) into daily_wins_count
  from daily_wins
  where profile_id = target_profile_id;

  select count(*) into duels_won_count
  from duels
  where winner_id = target_profile_id and closed_at is not null;

  select count(distinct dr.duel_id) into duels_played_count
  from duel_results dr
  join duels d on d.id = dr.duel_id
  where dr.profile_id = target_profile_id and d.closed_at is not null;

  select elo, ranked_games_played into my_elo, my_ranked_games
  from profiles
  where id = target_profile_id;

  if my_ranked_games > 0 then
    select count(*) + 1 into my_elo_rank
    from profiles p2
    where p2.ranked_games_played > 0 and p2.elo > my_elo;
  else
    my_elo_rank := null;
  end if;

  insert into logros_jugadores (profile_id, logro_id)
  select target_profile_id, l.id
  from logros l
  where l.is_active
    and (
      (l.metric_type = 'daily_maps_completed' and daily_maps_count >= l.threshold)
      or (l.metric_type = 'daily_wins' and daily_wins_count >= l.threshold)
      or (l.metric_type = 'duels_won' and duels_won_count >= l.threshold)
      or (l.metric_type = 'duels_played' and duels_played_count >= l.threshold)
      or (l.metric_type = 'elo_top_rank' and my_elo_rank is not null and my_elo_rank <= l.threshold)
    )
  on conflict (profile_id, logro_id) do nothing;
end;
$$;

-- daily_maps_completed: fires on every daily map submission.
create or replace function check_daily_stats_achievements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform check_and_grant_achievements(new.profile_id);
  return new;
end;
$$;

drop trigger if exists daily_stats_achievements_trigger on daily_stats;
create trigger daily_stats_achievements_trigger
  after insert on daily_stats
  for each row
  execute function check_daily_stats_achievements();

-- daily_wins: fires when award_daily_win() (0026) awards a day.
create or replace function check_daily_wins_achievements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform check_and_grant_achievements(new.profile_id);
  return new;
end;
$$;

drop trigger if exists daily_wins_achievements_trigger on daily_wins;
create trigger daily_wins_achievements_trigger
  after insert on daily_wins
  for each row
  execute function check_daily_wins_achievements();

-- duels_won / duels_played: fires once a duel closes (closed_at set),
-- checking every participant via duel_results — covers both 1v1 and
-- multiplayer duels.
create or replace function check_duel_achievements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  participant record;
begin
  if new.closed_at is not null and old.closed_at is null then
    for participant in
      select distinct profile_id from duel_results where duel_id = new.id
    loop
      perform check_and_grant_achievements(participant.profile_id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists duel_achievements_trigger on duels;
create trigger duel_achievements_trigger
  after update on duels
  for each row
  execute function check_duel_achievements();

-- elo_top_rank: fires whenever a player's own elo changes (i.e. every
-- ranked duel they finish) — apply_duel_elo() (0021) updates profiles.elo
-- inside the duels-close trigger above, which in turn fires this one.
create or replace function check_elo_achievements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.elo is distinct from old.elo then
    perform check_and_grant_achievements(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists profile_elo_achievements_trigger on profiles;
create trigger profile_elo_achievements_trigger
  after update on profiles
  for each row
  execute function check_elo_achievements();

-- Seed the initial catalog. Titles here are placeholders — edit
-- title/text/image_url from the admin panel's Logros tab whenever.
insert into logros (title, metric_type, threshold) values
  ('Top 5 ELO', 'elo_top_rank', 5),
  ('Top 3 ELO', 'elo_top_rank', 3),
  ('Top 2 ELO', 'elo_top_rank', 2),
  ('Top 1 ELO', 'elo_top_rank', 1),
  ('1 Daily Win', 'daily_wins', 1),
  ('3 Daily Wins', 'daily_wins', 3),
  ('10 Daily Wins', 'daily_wins', 10),
  ('1 Mapa del día completado', 'daily_maps_completed', 1),
  ('5 Mapas del día completados', 'daily_maps_completed', 5),
  ('10 Mapas del día completados', 'daily_maps_completed', 10),
  ('1 Duelo ganado', 'duels_won', 1),
  ('5 Duelos ganados', 'duels_won', 5),
  ('10 Duelos ganados', 'duels_won', 10),
  ('10 Duelos jugados', 'duels_played', 10),
  ('50 Duelos jugados', 'duels_played', 50),
  ('100 Duelos jugados', 'duels_played', 100),
  ('200 Duelos jugados', 'duels_played', 200),
  ('500 Duelos jugados', 'duels_played', 500);
