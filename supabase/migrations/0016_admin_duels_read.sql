-- Run this manually in the Supabase SQL editor.
--
-- The admin panel (ubicaba-admin) authenticates via plain Supabase Auth
-- (signInWithPassword), never through Clerk. requesting_user_id() reads the
-- Clerk `sub` claim, so it never matches a profile for an admin session, and
-- the existing duels/duel_results select policies (participants-only) always
-- evaluate to false there — an admin can't see any duel.
--
-- is_admin_user() tells an admin session apart from a player session: admin
-- accounts are created directly in the Supabase Auth dashboard (no public
-- signup), so they have a real row in auth.users. Clerk-issued JWTs verify
-- fine as "authenticated" but were never inserted into auth.users, since
-- third-party auth doesn't mirror users into that table.

create or replace function is_admin_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from auth.users where id = auth.uid())
$$;

create policy "admins can view all duels"
  on duels for select
  using (is_admin_user());

create policy "admins can view all duel results"
  on duel_results for select
  using (is_admin_user());
