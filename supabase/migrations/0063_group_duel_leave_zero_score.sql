-- Run this manually in the Supabase SQL editor.
--
-- Leaving a group can close one of its active duels right then
-- (close_group_duels_on_member_leave, 0050) — but by the time that trigger
-- runs, the leaving member's user_groups row is already gone, so
-- try_close_group_duel's member_count no longer counts them at all. If they
-- never played, they'd just silently vanish from the duel's outcome instead
-- of it counting as a loss. Give them an explicit duel_results row with
-- total_score = 0 (no rounds played) before the membership drop can close
-- the duel without them — on conflict do nothing so a real submitted score
-- is never overwritten.

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
    insert into duel_results (duel_id, profile_id, results, total_score)
    values (d.id, old.user_id, '[]'::jsonb, 0)
    on conflict (duel_id, profile_id) do nothing;

    perform try_close_group_duel(d.id);
  end loop;
  return old;
end;
$$;
