-- Run this manually in the Supabase SQL editor.
--
-- profiles' only UPDATE policy (0001) is "clerk_user_id = requesting_user_id()"
-- — a player updating their own row via their Clerk-issued JWT. The admin
-- panel signs in through native Supabase Auth instead (see is_admin_user()),
-- a completely different identity, so it never satisfies that check —
-- which is why editing a username from ubicaba-admin's UsersList/
-- UserBadgesModal silently failed. Same is_admin_user() bypass pattern
-- already used for logros/distintivos/etc.

create policy "admins can update any profile"
  on profiles for update
  using (is_admin_user())
  with check (is_admin_user());
