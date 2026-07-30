-- Drops the 5-minute wait from the 1v1 solo-close branch (was previously
-- paired with a "Reclamar victoria" button that only unlocked after 5
-- minutes — that timed UI is gone, replaced with a plain "Cerrar duelo"
-- button the lone player can use immediately, same freedom multiplayer's
-- creator already has.
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
        not is_multiplayer
        and duel_results_count(duels.id) = 1
        and exists (
          select 1 from profiles p
          where p.clerk_user_id = requesting_user_id()
            and duel_results_has_profile(duels.id, p.id)
        )
      )
    )
  );
