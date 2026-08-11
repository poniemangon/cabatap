-- Run this manually in the Supabase SQL editor.
--
-- Leaving a group only removes the user_groups membership row — it never
-- touches duels/duel_results, so past wins stay intact and reappear
-- correctly if they rejoin later (getGroupRanking counts historical
-- duels.winner_id regardless of current membership).
create policy "users can leave a group"
  on user_groups for delete
  using (
    exists (
      select 1 from profiles p
      where p.id = user_groups.user_id
        and p.clerk_user_id = requesting_user_id()
    )
  );

-- Group creator can rename it / change its photo.
create policy "group creator can update the group"
  on groups for update
  using (
    exists (
      select 1 from profiles p
      where p.id = groups.created_by
        and p.clerk_user_id = requesting_user_id()
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = groups.created_by
        and p.clerk_user_id = requesting_user_id()
    )
  );

-- Shared closing logic, extracted out of close_group_duel_if_complete (0048)
-- so it can also run when a member leaves — if they were the last one an
-- active group duel was waiting on, that duel should close right then
-- (with whoever already played), not sit stuck forever waiting on someone
-- no longer in the group.
create or replace function try_close_group_duel(target_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_duel record;
  member_count int;
  result_count int;
  top_score int;
  tie_count int;
  winner uuid;
begin
  select * into target_duel from duels where id = target_duel_id;
  if target_duel.group_duel is null or target_duel.closed_at is not null then
    return;
  end if;

  select count(*) into member_count from user_groups where group_id = target_duel.group_duel;
  select count(distinct profile_id) into result_count from duel_results where duel_id = target_duel.id;
  if result_count < member_count then
    return;
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

create or replace function close_group_duel_if_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform try_close_group_duel(new.duel_id);
  return new;
end;
$$;

create or replace function close_group_duels_on_member_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
begin
  for d in select id from duels where group_duel = old.group_id and closed_at is null loop
    perform try_close_group_duel(d.id);
  end loop;
  return old;
end;
$$;

drop trigger if exists close_group_duels_on_leave_trigger on user_groups;
create trigger close_group_duels_on_leave_trigger
  after delete on user_groups
  for each row
  execute function close_group_duels_on_member_leave();
