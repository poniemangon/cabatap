-- Run this manually in the Supabase SQL editor.
--
-- 1) Renames the 30 pre-seeded bot profiles (0066) from English to Spanish
--    word+word+number usernames, same lowercase style.

with renames (old_username, new_username) as (
  values
    ('silentfox42', 'zorrosilencioso42'),
    ('brightwolf17', 'lobobrillante17'),
    ('quietstorm63', 'tormentaquieta63'),
    ('happytiger29', 'tigrefeliz29'),
    ('coldriver91', 'riofrio91'),
    ('darkeagle38', 'aguilaoscura38'),
    ('brightlion56', 'leonbrillante56'),
    ('silentbear74', 'ososilencioso74'),
    ('happyhawk22', 'halconfeliz22'),
    ('coldwolf85', 'lobofrio85'),
    ('quiettiger11', 'tigrequieto11'),
    ('darkfalcon67', 'cuervooscuro67'),
    ('brightriver34', 'riobrillante34'),
    ('silentstorm99', 'tormentasilenciosa99'),
    ('happyeagle48', 'aguilafeliz48'),
    ('coldfox16', 'zorrofrio16'),
    ('darklion73', 'leonoscuro73'),
    ('brighthawk28', 'halconbrillante28'),
    ('quietbear52', 'osoquieto52'),
    ('silenttiger39', 'tigresilencioso39'),
    ('happywolf64', 'lobofeliz64'),
    ('coldeagle87', 'aguilafria87'),
    ('darkriver21', 'riooscuro21'),
    ('brightfox58', 'zorrobrillante58'),
    ('quietfalcon33', 'gavilanquieto33'),
    ('silentlion76', 'leonsilencioso76'),
    ('happystorm41', 'tormentafeliz41'),
    ('coldhawk19', 'gavilanfrio19'),
    ('darkbear82', 'ososcuro82'),
    ('brighttiger47', 'tigrebrillante47')
)
update profiles p
set username = r.new_username
from renames r
where p.username = r.old_username and p.is_bot;

-- 2) submit_bot_duel_result(): now also fabricates a guess coordinate,
--    offset from the actual location by the same random distance already
--    used for scoring (destination-point formula, random bearing) — so the
--    bot's pin actually shows up on the map instead of just the
--    actual-location marker with no guess drawn.
create or replace function submit_bot_duel_result(target_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  bot_id uuid;
  results jsonb := '[]'::jsonb;
  total int := 0;
  idx int;
  pi int;
  loc record;
  distance numeric;
  points int;
  bearing numeric;
  angular_dist numeric;
  lat1 numeric;
  lng1 numeric;
  new_lat numeric;
  new_lng numeric;
begin
  select * into d from duels where id = target_duel_id;
  if d.id is null then
    raise exception 'duel not found';
  end if;

  if not exists (
    select 1 from profiles p
    where p.id = d.challenger_id and p.clerk_user_id = requesting_user_id()
  ) then
    raise exception 'not authorized';
  end if;

  select id into bot_id from profiles where id = d.opponent_id and is_bot;
  if bot_id is null then
    raise exception 'opponent is not a bot';
  end if;

  for idx in 1 .. array_length(d.round_indices, 1) loop
    pi := d.round_indices[idx];
    select street1, street2, lat, lng into loc from intersections where pool_index = pi;

    distance := round(power(random(), 2) * 3000);
    points := greatest(0, (case when distance <= 50 then 100 else 100 - floor((distance - 50) / 66) end)::int);
    total := total + points;

    bearing := random() * 2 * pi();
    angular_dist := distance / 6371000.0;
    lat1 := radians(loc.lat);
    lng1 := radians(loc.lng);
    new_lat := asin(sin(lat1) * cos(angular_dist) + cos(lat1) * sin(angular_dist) * cos(bearing));
    new_lng := lng1 + atan2(sin(bearing) * sin(angular_dist) * cos(lat1), cos(angular_dist) - sin(lat1) * sin(new_lat));

    results := results || jsonb_build_object(
      'street1', loc.street1,
      'street2', loc.street2,
      'guess', jsonb_build_array(degrees(new_lat), degrees(new_lng)),
      'actual', jsonb_build_array(loc.lat, loc.lng),
      'distance', distance,
      'points', points
    );
  end loop;

  insert into duel_results (duel_id, profile_id, results, total_score)
  values (target_duel_id, bot_id, results, total)
  on conflict (duel_id, profile_id) do nothing;
end;
$$;
