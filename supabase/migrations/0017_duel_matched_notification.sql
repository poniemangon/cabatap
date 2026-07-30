-- New notification type: fires when someone claims a still-open 1v1 duel
-- (a "Duelo random" match or a direct link share), so the challenger who's
-- been sitting on their own gameOver screen finds out without needing to
-- reload or stumble back onto it.
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('duel_completed', 'friend_request', 'duel_matched'));

create policy "opponent can notify the challenger a duel was matched"
  on notifications for insert
  with check (
    type = 'duel_matched'
    and exists (
      select 1 from duels d
      join profiles requester on requester.clerk_user_id = requesting_user_id()
      where d.id = notifications.duel_id
        and d.opponent_id = requester.id
        and d.challenger_id = notifications.profile_id
        and not d.is_multiplayer
    )
  );
