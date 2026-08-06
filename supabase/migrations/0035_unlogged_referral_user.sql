-- Run this manually in the Supabase SQL editor.
--
-- Every share link in the app now carries ?referral=<username> — 'unlogged'
-- specifically when the sharer isn't signed in (see appendReferral() /
-- referralUsername in App.jsx), instead of skipping the tag entirely like
-- before. record_referral_visit() (0033_referrals.sql) looks up the
-- referrer by username, so a real profiles row named "unlogged" needs to
-- exist for those visits to land anywhere instead of silently no-op'ing.
--
-- clerk_user_id is a placeholder, not a real auth identity — this profile
-- can never actually sign in (no Supabase Auth user has this id), it only
-- exists as a landing spot for record_referral_visit()'s lookup.

insert into profiles (clerk_user_id, username)
values ('system-unlogged-referral-user', 'unlogged')
on conflict (clerk_user_id) do nothing;
