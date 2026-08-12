-- Run this manually in the Supabase SQL editor.
--
-- 42P17 "infinite recursion detected in policy for relation duels" —
-- broke every duel's SELECT (findOpenRandomDuel, "Duelo rankeado" wouldn't
-- even open). Same root cause as 0049's duel_results fix, just on the
-- other table this time, and self-inflicted: when 0048 added group_duel is
-- null to the "duel participants can close it and set the winner" policy,
-- it was written against 0003's ORIGINAL wording — a raw
-- `(select count(*) from duel_results dr where dr.duel_id = duels.id)`
-- subquery. But 0005 had already replaced that exact subquery with the
-- duel_results_count() helper specifically to avoid duels' policy
-- querying duel_results, whose own SELECT policy queries duels right
-- back. 0048 unknowingly reverted that fix while adding the group_duel
-- condition. This restores duel_results_count(), keeping group_duel is
-- null intact.

drop policy if exists "duel participants can close it and set the winner" on duels;
create policy "duel participants can close it and set the winner"
  on duels for update
  using (closed_at is null)
  with check (
    closed_at is not null
    and group_duel is null
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
