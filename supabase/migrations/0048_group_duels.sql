-- Run this manually in the Supabase SQL editor.
--
-- Group duels: a duel tagged with group_duel = <groups.id>. Otherwise
-- identical to a regular multiplayer duel (is_multiplayer = true, same
-- barrio-pool round selection, same duel_results flow) except:
--  - only members of that group can create one or submit a result for it
--  - it can never be closed manually — closing is fully automatic, once
--    every current group member has a duel_results row (see the trigger
--    at the bottom)

alter table duels add column group_duel uuid references groups(id) on delete cascade;

-- Creating a group duel requires being a member of the target group.
drop policy if exists "users can create duels as challenger" on duels;
create policy "users can create duels as challenger"
  on duels for insert
  with check (
    exists (
      select 1 from profiles p
      where p.id = duels.challenger_id
        and p.clerk_user_id = requesting_user_id()
    )
    and (
      duels.group_duel is null
      or exists (
        select 1 from user_groups ug
        join profiles p2 on p2.id = ug.user_id
        where ug.group_id = duels.group_duel
          and p2.clerk_user_id = requesting_user_id()
      )
    )
  );

-- Manual closing (the existing "Cerrar duelo" flow) explicitly excludes
-- group duels — group_duel is null added to both branches. A group duel can
-- only transition closed_at null -> not null via close_group_duel_if_complete()
-- below, which is SECURITY DEFINER and so bypasses RLS entirely.
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
        and (select count(*) from duel_results dr where dr.duel_id = duels.id) >= 2
        and exists (
          select 1 from profiles p
          where p.clerk_user_id = requesting_user_id()
            and p.id in (duels.challenger_id, duels.opponent_id)
        )
      )
      or (
        is_multiplayer
        and (select count(*) from duel_results dr where dr.duel_id = duels.id) >= 2
        and exists (
          select 1 from profiles p
          where p.clerk_user_id = requesting_user_id()
            and p.id = duels.challenger_id
        )
      )
    )
  );

-- Submitting a result for a group duel requires still being a member of
-- that group (same shape as the existing multiplayer/1v1 branches, with a
-- group-membership check added to the multiplayer one).
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
          and (
            d.max_players is null
            or (select count(*) from duel_results dr2 where dr2.duel_id = d.id) < d.max_players
          )
          and (
            d.group_duel is null
            or exists (
              select 1 from user_groups ug
              where ug.group_id = d.group_duel
                and ug.user_id = duel_results.profile_id
            )
          )
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

-- Auto-closes a group duel once every current member of its group has a
-- duel_results row — computes the winner the same way computeWinnerId()
-- (duelApi.js) does: top score wins, a tie for first leaves winner_id null.
create or replace function close_group_duel_if_complete()
returns trigger
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
  select * into target_duel from duels where id = new.duel_id;
  if target_duel.group_duel is null or target_duel.closed_at is not null then
    return new;
  end if;

  select count(*) into member_count from user_groups where group_id = target_duel.group_duel;
  select count(distinct profile_id) into result_count from duel_results where duel_id = target_duel.id;
  if result_count < member_count then
    return new;
  end if;

  select max(total_score) into top_score from duel_results where duel_id = target_duel.id;
  select count(*) into tie_count from duel_results where duel_id = target_duel.id and total_score = top_score;

  if tie_count = 1 then
    select profile_id into winner from duel_results where duel_id = target_duel.id and total_score = top_score;
  else
    winner := null;
  end if;

  update duels set closed_at = now(), winner_id = winner where id = target_duel.id;
  return new;
end;
$$;

drop trigger if exists close_group_duel_trigger on duel_results;
create trigger close_group_duel_trigger
  after insert on duel_results
  for each row
  execute function close_group_duel_if_complete();
