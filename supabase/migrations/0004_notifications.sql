-- Run after 0003_duel_winner_and_stats.sql, in the Supabase SQL editor.
--
-- Notifications for: a duel you're in just closed, or someone sent you a
-- friend request. `data` carries just enough to render/link the row without
-- an extra join (invite_code for duels, the sender's username for friend
-- requests) — populated by the client at insert time since it already has
-- that info in hand.
--
-- After running this file, also enable Realtime replication for this table
-- (Supabase Dashboard > Database > Replication, or the ALTER PUBLICATION
-- statement at the bottom) so the bell icon updates live.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('duel_completed', 'friend_request')),
  duel_id uuid references duels(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx on notifications (profile_id, created_at desc);

alter table notifications enable row level security;

create policy "users can view their own notifications"
  on notifications for select
  using (
    exists (
      select 1 from profiles p
      where p.id = notifications.profile_id
        and p.clerk_user_id = requesting_user_id()
    )
  );

create policy "users can mark their own notifications read"
  on notifications for update
  using (
    exists (
      select 1 from profiles p
      where p.id = notifications.profile_id
        and p.clerk_user_id = requesting_user_id()
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = notifications.profile_id
        and p.clerk_user_id = requesting_user_id()
    )
  );

-- Insert is the one deliberate exception: a user must be able to write a
-- notification row targeting someone else (the person being notified).
-- Each branch proves the write via a related row the requester actually
-- caused to exist, mirroring the friendships/duel_results insert policies.

create policy "requester can notify the addressee of a friend request"
  on notifications for insert
  with check (
    type = 'friend_request'
    and exists (
      select 1 from friendships f
      join profiles p on p.clerk_user_id = requesting_user_id()
      where f.requester_id = p.id
        and f.addressee_id = notifications.profile_id
        and f.status = 'pending'
    )
  );

-- Scoped to one specific closed duel (notifications.duel_id): the requester
-- must themselves be a participant of that exact duel, and so must the
-- profile being notified — so you can only notify people you actually just
-- played against/with, never an arbitrary profile.
create policy "closer can notify duel participants that it completed"
  on notifications for insert
  with check (
    type = 'duel_completed'
    and exists (
      select 1 from duels d
      join profiles requester on requester.clerk_user_id = requesting_user_id()
      join duel_results dr_requester on dr_requester.duel_id = d.id and dr_requester.profile_id = requester.id
      join duel_results dr_target on dr_target.duel_id = d.id and dr_target.profile_id = notifications.profile_id
      where d.id = notifications.duel_id
        and d.closed_at is not null
    )
  );

alter publication supabase_realtime add table notifications;
