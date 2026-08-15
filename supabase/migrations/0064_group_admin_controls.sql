-- Run this manually in the Supabase SQL editor.
--
-- 1) Group admin (groups.created_by) can force-close their group's active
--    duel right now, picking a winner from whatever results already exist —
--    same winner logic as try_close_group_duel (0050), just without waiting
--    for every member to have played. An RPC rather than a raw UPDATE
--    policy since it needs to read duel_results to compute the winner.
create or replace function admin_close_group_duel(target_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_duel record;
  top_score int;
  tie_count int;
  winner uuid;
begin
  select * into target_duel from duels where id = target_duel_id;
  if target_duel.id is null or target_duel.group_duel is null then
    raise exception 'not a group duel';
  end if;
  if target_duel.closed_at is not null then
    return;
  end if;

  if not exists (
    select 1 from groups g
    join profiles p on p.id = g.created_by
    where g.id = target_duel.group_duel
      and p.clerk_user_id = requesting_user_id()
  ) then
    raise exception 'not authorized';
  end if;

  select max(total_score) into top_score from duel_results where duel_id = target_duel.id;
  select count(*) into tie_count from duel_results where duel_id = target_duel.id and total_score = top_score;

  if tie_count = 1 then
    select profile_id into winner from duel_results where duel_id = target_duel.id and total_score = top_score;
  else
    winner := null;
  end if;

  update duels set closed_at = now(), winner_id = winner where id = target_duel.id;
end;
$$;

-- 2) Group admin can delete a duel belonging to their group outright (e.g.
--    a stuck one nobody will ever finish) — duel_results cascades (0001).
create policy "group admin can delete a group duel"
  on duels for delete
  using (
    group_duel is not null
    and exists (
      select 1 from groups g
      join profiles p on p.id = g.created_by
      where g.id = duels.group_duel
        and p.clerk_user_id = requesting_user_id()
    )
  );

-- 3) Admin succession: if the group's creator leaves, hand created_by to
--    whoever's been in the group longest among those who remain. Runs
--    alongside close_group_duels_on_member_leave (0050) — both fire on the
--    same DELETE, independent of each other.
create or replace function reassign_group_admin_on_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_admin uuid;
begin
  if old.user_id is distinct from (select created_by from groups where id = old.group_id) then
    return old;
  end if;

  select user_id into next_admin
  from user_groups
  where group_id = old.group_id
  order by joined_at asc
  limit 1;

  if next_admin is not null then
    update groups set created_by = next_admin where id = old.group_id;
  end if;

  return old;
end;
$$;

drop trigger if exists reassign_group_admin_on_leave_trigger on user_groups;
create trigger reassign_group_admin_on_leave_trigger
  after delete on user_groups
  for each row
  execute function reassign_group_admin_on_leave();
