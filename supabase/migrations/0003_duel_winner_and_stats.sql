-- Run after 0002_duels_open_multiplayer.sql, in the Supabase SQL editor.
--
-- Adds a persisted winner + a way to close a duel, so win/played stats can be
-- computed. 1v1 duels auto-close once both sides have played (only ever 2
-- slots). Multiplayer duels get an explicit max_players cap at creation and
-- are closed manually by the challenger (creator) once at least 2 people
-- have played. Existing multiplayer duels (created before this migration)
-- have no cap: max_players is null there, which is treated as "uncapped".

alter table duels add column max_players int;
alter table duels add column winner_id uuid references profiles(id);
alter table duels add column closed_at timestamptz;

alter table duels add constraint duels_multiplayer_max_players_check
  check (not is_multiplayer or max_players is null or max_players >= 2);

-- Closing a duel (closed_at null -> not null, winner_id set alongside it) is
-- allowed for:
--  (a) 1v1: either participant, once both have a duel_results row
--  (b) multiplayer: only the challenger (creator), once >=2 people have played
create policy "duel participants can close it and set the winner"
  on duels for update
  using (closed_at is null)
  with check (
    closed_at is not null
    and (
      (
        not is_multiplayer
        and (select count(*) from duel_results dr where dr.duel_id = duels.id) >= 2
        and exists (
          select 1 from profiles p
          where p.clerk_user_id = requesting_user_id()
            and p.id in (duels.challenger_id, duels.opponent_id)
        )
      )
      or (
        is_multiplayer
        and (select count(*) from duel_results dr where dr.duel_id = duels.id) >= 2
        and exists (
          select 1 from profiles p
          where p.clerk_user_id = requesting_user_id()
            and p.id = duels.challenger_id
        )
      )
    )
  );

-- duel_results insert policy: same participant checks as 0002, plus the
-- duel must still be open, and multiplayer duels enforce the max_players cap.
drop policy if exists "users can submit their own duel result" on duel_results;

create policy "users can submit their own duel result"
  on duel_results for insert
  with check (
    exists (
      select 1 from profiles p
      where p.id = duel_results.profile_id
        and p.clerk_user_id = requesting_user_id()
    )
    and (
      exists (
        select 1 from duels d
        where d.id = duel_results.duel_id
          and d.is_multiplayer
          and d.closed_at is null
          and (
            d.max_players is null
            or (select count(*) from duel_results dr2 where dr2.duel_id = d.id) < d.max_players
          )
      )
      or exists (
        select 1 from duels d
        where d.id = duel_results.duel_id
          and not d.is_multiplayer
          and d.closed_at is null
          and (d.challenger_id = duel_results.profile_id or d.opponent_id = duel_results.profile_id)
      )
    )
  );
