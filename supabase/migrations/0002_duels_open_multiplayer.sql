-- Run after 0001_profiles_friendships_duels.sql, in the Supabase SQL editor.
--
-- Adds a second duel type alongside the original 1v1: a "multiplayer" open
-- lobby where anyone holding the invite link can join and play, with no
-- single opponent slot to claim. 1v1 duels keep working exactly as in 0001
-- (challenger + one claimed opponent_id) — is_multiplayer just tells the app
-- and RLS which rules apply to a given duel.

alter table duels add column is_multiplayer boolean not null default false;

-- Claiming (setting opponent_id) only makes sense for 1v1 duels — a
-- multiplayer duel never sets opponent_id at all.
drop policy if exists "users can claim an unclaimed duel invite" on duels;

create policy "users can claim an unclaimed 1v1 duel invite"
  on duels for update
  using (opponent_id is null and not is_multiplayer)
  with check (
    exists (
      select 1 from profiles p
      where p.id = opponent_id
        and p.clerk_user_id = requesting_user_id()
    )
  );

-- duels SELECT is unchanged from 0001: "opponent_id is null or you're a
-- participant" already covers multiplayer duels for free, since they never
-- set opponent_id.

drop policy if exists "duel participants can view results" on duel_results;

create policy "duel results are viewable by multiplayer joiners or 1v1 participants"
  on duel_results for select
  using (
    exists (select 1 from duels d where d.id = duel_results.duel_id and d.is_multiplayer)
    or exists (
      select 1 from duels d
      join profiles p on p.clerk_user_id = requesting_user_id()
      where d.id = duel_results.duel_id
        and p.id in (d.challenger_id, d.opponent_id)
    )
  );

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
      exists (select 1 from duels d where d.id = duel_results.duel_id and d.is_multiplayer)
      or exists (
        select 1 from duels d
        where d.id = duel_results.duel_id
          and (d.challenger_id = duel_results.profile_id or d.opponent_id = duel_results.profile_id)
      )
    )
  );
