-- Run this manually in the Supabase SQL editor.
--
-- Logs IP + user-agent for ghost-mode players specifically (see 0066) —
-- since a ghost is otherwise invisible everywhere, this gives the admin a
-- way to still see who/what device is actually behind one, e.g. for
-- moderation. Both values are read server-side from the request's own
-- headers (Supabase sits behind Cloudflare — cf-connecting-ip is the
-- reliable single-IP header; x-forwarded-for as a fallback), never trusted
-- from anything the client claims, so they can't be spoofed.

create table ghost_activity_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index ghost_activity_log_profile_idx on ghost_activity_log (profile_id);

alter table ghost_activity_log enable row level security;

create policy "admins can read ghost activity"
  on ghost_activity_log for select
  using (is_admin_user());

-- No insert/update/delete policy for anon/authenticated on purpose — the
-- only writer is log_ghost_activity() below, SECURITY DEFINER so it
-- bypasses RLS regardless, and it silently no-ops for anyone who isn't
-- actually flagged ghost_mode — safe to call unconditionally from the
-- client without ever revealing (via an error, or lack of one) whether a
-- given account is a ghost.
create or replace function log_ghost_activity(client_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_profile record;
  headers json;
  ip text;
begin
  select id, ghost_mode into caller_profile
  from profiles
  where clerk_user_id = requesting_user_id();

  if caller_profile.id is null or not caller_profile.ghost_mode then
    return;
  end if;

  headers := current_setting('request.headers', true)::json;
  ip := coalesce(headers->>'cf-connecting-ip', split_part(headers->>'x-forwarded-for', ',', 1));

  insert into ghost_activity_log (profile_id, ip_address, user_agent)
  values (caller_profile.id, ip, coalesce(client_user_agent, headers->>'user-agent'));
end;
$$;
