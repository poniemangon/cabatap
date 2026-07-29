-- Run after 0011_daily_stats.sql, in the Supabase SQL editor.
--
-- Fixes a regression from 0010: the forfeit clause it added to the duels
-- "close" policy queried duel_results directly (`join duel_results dr on
-- ...`) instead of going through the duel_results_count() security-definer
-- function like every other branch does. That raw join re-triggers
-- duel_results' own RLS policy, which queries duels right back — the same
-- "infinite recursion detected in policy for relation duels" (42P17) cycle
-- 0005 fixed, reopened by this one un-guarded query. It broke *any* update
-- to an open duel (e.g. claiming a matchmaking invite), not just forfeits,
-- since Postgres evaluates every policy branch to compute the OR.
--
-- Fix: a second security-definer helper, mirroring duel_results_count(),
-- that answers "does this profile have a duel_results row for this duel"
-- without touching duel_results' RLS at all.

create or replace function duel_results_has_profile(target_duel_id uuid, target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from duel_results
    where duel_id = target_duel_id
      and profile_id = target_profile_id
  )
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
      or (
        -- Forfeit: I'm the only one who's played, and it's been long enough
        -- that the rival clearly isn't coming back.
        not is_multiplayer
        and duel_results_count(duels.id) = 1
        and duels.created_at < now() - interval '5 minutes'
        and exists (
          select 1 from profiles p
          where p.clerk_user_id = requesting_user_id()
            and duel_results_has_profile(duels.id, p.id)
        )
      )
    )
  );
