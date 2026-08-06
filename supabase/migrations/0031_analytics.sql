-- Run this manually in the Supabase SQL editor.
--
-- Lightweight first-party analytics: a client-generated session id
-- (localStorage UUID, works signed-in or anonymous — no auth binding, same
-- trust model as any tracking-pixel-style analytics) heartbeats its
-- last_seen_at every ~45s while the app is open, and logs one row per
-- route change. Three things the admin panel needs:
--   - "online now"  -> analytics_sessions where last_seen_at is recent
--   - "unique users" -> distinct rows in analytics_sessions (one per
--     session id, by construction)
--   - "pages visited" -> analytics_pageviews grouped by path
--
-- Insert/update are open to anyone (the whole point is capturing anonymous
-- visitors too), select is admin-only — regular app code never reads this
-- back, only the ubicaba-admin panel does.

create table analytics_sessions (
  id uuid primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table analytics_pageviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references analytics_sessions(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);

create index analytics_pageviews_session_idx on analytics_pageviews (session_id);
create index analytics_pageviews_created_idx on analytics_pageviews (created_at);
create index analytics_pageviews_path_idx on analytics_pageviews (path);

alter table analytics_sessions enable row level security;
alter table analytics_pageviews enable row level security;

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

create policy "anyone can log a pageview"
  on analytics_pageviews for insert
  with check (true);

create policy "admins can read pageviews"
  on analytics_pageviews for select
  using (is_admin_user());

-- Server-side aggregation for "top pages" — avoids pulling potentially
-- thousands of raw pageview rows into the admin panel just to count them
-- client-side. Admin-gated inside the function itself (not just via table
-- RLS), since a SECURITY DEFINER function bypasses RLS for its own query
-- and is otherwise callable by anyone.
create or replace function top_pageviews(since timestamptz, result_limit int default 20)
returns table(path text, views bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_user() then
    raise exception 'not authorized';
  end if;

  return query
    select p.path, count(*) as views
    from analytics_pageviews p
    where p.created_at >= since
    group by p.path
    order by views desc
    limit result_limit;
end;
$$;
