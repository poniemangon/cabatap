-- Run this manually in the Supabase SQL editor.
--
-- Diagnostic + fix for "new row violates row-level security policy for
-- table analytics_sessions" (Postgres 42501) on the heartbeat upsert. That
-- specific message means RLS is enabled and a WITH CHECK failed — since
-- 0031_analytics.sql's policies are `with check (true)` (can never fail),
-- whatever's actually live on the table must differ from that file, most
-- likely because create policy errors out ("policy already exists") on a
-- re-run instead of replacing anything, so an earlier/stricter attempt
-- could still be the one in effect.
--
-- Run the SELECT first to see what's actually there:
--
--   select policyname, cmd, permissive, roles, qual, with_check
--   from pg_policies
--   where tablename in ('analytics_sessions', 'analytics_pageviews');
--
-- Then run the fix below — drop-if-exists + recreate guarantees the
-- correct policies regardless of whatever history led to this, and is
-- safe to run more than once.

drop policy if exists "anyone can heartbeat a session" on analytics_sessions;
drop policy if exists "anyone can update their own session's heartbeat" on analytics_sessions;
drop policy if exists "admins can read sessions" on analytics_sessions;

create policy "anyone can heartbeat a session"
  on analytics_sessions for insert
  with check (true);

create policy "anyone can update their own session's heartbeat"
  on analytics_sessions for update
  using (true)
  with check (true);

create policy "admins can read sessions"
  on analytics_sessions for select
  using (is_admin_user());

drop policy if exists "anyone can log a pageview" on analytics_pageviews;
drop policy if exists "admins can read pageviews" on analytics_pageviews;

create policy "anyone can log a pageview"
  on analytics_pageviews for insert
  with check (true);

create policy "admins can read pageviews"
  on analytics_pageviews for select
  using (is_admin_user());
