-- Run after 0009_notifications_delete.sql, in the Supabase SQL editor.
--
-- 1v1 has no admin to force a close (unlike multiplayer), so if your rival
-- never finishes — closes the tab, walks away, whatever — you're stuck on
-- "esperando a tu rival" forever with nothing ever recorded. This lets the
-- one participant who *did* submit a result close the duel themselves and
-- claim the win by forfeit, once enough time has passed that it's clearly
-- not just the rival taking a moment.

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
          join duel_results dr on dr.profile_id = p.id and dr.duel_id = duels.id
          where p.clerk_user_id = requesting_user_id()
        )
      )
    )
  );
