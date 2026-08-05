-- Run this manually in the Supabase SQL editor.
--
-- useProfile.js's ensureProfile() re-syncs avatar_url from the OAuth
-- provider (Google, etc.) on every sign-in, so a user's profile photo
-- doesn't stay frozen on a stale Clerk-era image forever. That sync had no
-- way to tell "the provider's photo" apart from "the user manually set a
-- custom one" via the profile page's avatar editor — so a manually-chosen
-- avatar got silently overwritten back to the Google photo on the very
-- next sign-in/session refresh. avatar_is_custom marks the latter so the
-- sync can skip it.

alter table profiles add column avatar_is_custom boolean not null default false;
