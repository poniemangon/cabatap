-- Removes the "forfeit" close branch entirely (duel_results_count = 1,
-- close-and-declare-yourself-winner). Two problems with it:
--
-- 1. It never actually validated that winner_id in the UPDATE matched the
--    calling participant's own profile id — only that the caller HAD a
--    result. A buggy (or malicious) client could set winner_id to the
--    *other* participant's id and RLS would allow it. This is very likely
--    how a real duel ended up with winner_id pointing at the player who
--    never submitted a result at all.
-- 2. It's dead code now regardless: "Cerrar duelo" for a private 1v1 with
--    no response deletes the duel outright (see 0027), and matchmaking
--    duels have no close/cancel UI at all anymore — nothing in the client
--    calls closeDuel() with only 1 result present any more. Abandonment is
--    handled by the tab-close beacon submitting a 0-point result instead,
--    so a duel only ever auto-closes once both sides genuinely have a
--    row, and computeWinnerId() picks the real winner correctly.
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
