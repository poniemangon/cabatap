-- Run after 0004_notifications.sql, in the Supabase SQL editor.
--
-- Fixes: "infinite recursion detected in policy for relation duels" (42P17).
-- The 0003 "close" policy on `duels` reads `duel_results` to count how many
-- people have played; `duel_results`'s own policies read `duels` right back
-- (to check is_multiplayer/participants) — that mutual dependency is a
-- cycle, and Postgres's RLS planner refuses to evaluate it.
--
-- Fix: a SECURITY DEFINER function reads duel_results without going through
-- its RLS policies at all (it runs as the function's owner, which bypasses
-- RLS in Supabase), so the `duels` policy no longer has an edge back into
-- `duel_results`'s policies — breaking the cycle.

create or replace function duel_results_count(target_duel_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*) from duel_results where duel_id = target_duel_id
$$;

drop policy if exists "duel participants can close it and set the winner" on duels;

create policy "duel participants can close it and set the winner"
  on duels for update
  using (closed_at is null)
  with check (
    closed_at is not null
    and (
      (
        not is_multiplayer
        and duel_results_count(duels.id) >= 2
        and exists (
          select 1 from profiles p
          where p.clerk_user_id = requesting_user_id()
            and p.id in (duels.challenger_id, duels.opponent_id)
        )
      )
      or (
        is_multiplayer
        and duel_results_count(duels.id) >= 2
        and exists (
          select 1 from profiles p
          where p.clerk_user_id = requesting_user_id()
            and p.id = duels.challenger_id
        )
      )
    )
  );

-- Same fix applied to the multiplayer max_players cap check, so submitting
-- a result can't open the same kind of cycle.
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
          and (d.max_players is null or duel_results_count(d.id) < d.max_players)
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

-- Random matchmaking: tags a duel as a matchmaking-queue entry (created by
-- "Duelo random" with no opponent yet), as opposed to a private "cualquiera
-- (link)" open invite. The two pools are kept separate: a private open
-- invite lets its challenger play immediately, while a matchmaking entry
-- waits for an opponent before starting.
alter table duels add column matchmaking boolean not null default false;
