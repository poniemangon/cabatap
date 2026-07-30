-- Lets submitDuelResult upsert instead of plain-insert: a duplicate
-- submission attempt (e.g. a reload racing the submission effect) was
-- hitting duel_results' unique(duel_id, profile_id) constraint as a hard
-- 409 error instead of just overwriting with the latest attempt, the same
-- way daily_stats already handles this for the daily challenge.
create policy "users can update their own duel result"
  on duel_results for update
  using (
    exists (
      select 1 from profiles p
      where p.id = duel_results.profile_id
        and p.clerk_user_id = requesting_user_id()
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = duel_results.profile_id
        and p.clerk_user_id = requesting_user_id()
    )
  );
