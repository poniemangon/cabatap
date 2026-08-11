-- Run this manually in the Supabase SQL editor.
--
-- 42P17 "infinite recursion detected in policy for relation duel_results".
-- The INSERT policy's WITH CHECK includes a max_players cap check that
-- queries duel_results itself:
--   (select count(*) from duel_results dr2 where dr2.duel_id = d.id) < d.max_players
-- Evaluating that subquery requires applying duel_results' own RLS again
-- while Postgres is still mid-evaluation of this same table's INSERT
-- policy — that's what trips the recursion detector. This exact subquery
-- shape has existed since 0003 (untouched there), it just never got
-- exercised in a way that surfaced this until group duels (0048) added
-- another branch to the same policy.
--
-- Fix: drop the self-referential subquery from the policy entirely, and
-- enforce the max_players cap in a plain BEFORE INSERT trigger instead —
-- ordinary SQL, no RLS policy involved, so no recursion is possible there.

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

create or replace function enforce_duel_max_players()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap int;
  current_count int;
begin
  select max_players into cap from duels where id = new.duel_id;
  if cap is null then
    return new;
  end if;

  select count(*) into current_count from duel_results where duel_id = new.duel_id;
  if current_count >= cap then
    raise exception 'This duel is already full';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_duel_max_players_trigger on duel_results;
create trigger enforce_duel_max_players_trigger
  before insert on duel_results
  for each row
  execute function enforce_duel_max_players();
