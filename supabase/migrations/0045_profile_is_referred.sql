-- Run this manually in the Supabase SQL editor.
--
-- Whether this player's account was created after arriving via a referral
-- link (?referral=<username>, see Analytics.jsx). Separate from the
-- existing `referrals` table (which tracks visit_count per REFERRER) —
-- this is a flag on the REFERRED player's own profile, set once at
-- signup by useProfile.js's ensureProfile(), never touched afterward.

alter table profiles add column is_referred boolean not null default false;
