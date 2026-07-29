-- Run after 0008_duel_time_limit.sql, in the Supabase SQL editor.
--
-- Notifications are now deleted rather than just marked read: once clicked
-- (client-side), or opportunistically pruned once they're older than a day
-- (client does this on every load — no cron/scheduled job needed). Needs a
-- DELETE policy, which 0004 never added (only select/update/insert).

create policy "users can delete their own notifications"
  on notifications for delete
  using (
    exists (
      select 1 from profiles p
      where p.id = notifications.profile_id
        and p.clerk_user_id = requesting_user_id()
    )
  );
