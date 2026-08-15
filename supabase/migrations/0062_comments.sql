-- Run this manually in the Supabase SQL editor.
--
-- Player-submitted comments/suggestions about a specific intersection
-- (wrong street name, bad photo, wrong pin location, etc.) — surfaced from
-- the duel result map (clicking a round's actual-location marker) and
-- reviewed in the admin panel. `seen` lets the admin panel grey out ones
-- already reviewed; it flips true the moment the admin opens the detail
-- popup for that comment.

create table comments (
  id uuid primary key default gen_random_uuid(),
  pool_index int not null references intersections(pool_index) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  seen boolean not null default false,
  created_at timestamptz not null default now()
);

create index comments_pool_index_idx on comments (pool_index);
create index comments_profile_idx on comments (profile_id);
create index comments_created_idx on comments (created_at);

alter table comments enable row level security;

-- Only the signed-in player themselves can write a comment attributed to
-- their own profile_id — same ownership-check pattern as every other
-- Clerk-identity-gated insert in this schema (see requesting_user_id()).
create policy "users can add their own comment"
  on comments for insert
  with check (
    exists (
      select 1 from profiles p
      where p.id = comments.profile_id
        and p.clerk_user_id = requesting_user_id()
    )
  );

-- Comments are moderation/feedback data, not public — only the admin panel
-- ever reads them back.
create policy "admins can read comments"
  on comments for select
  using (is_admin_user());

create policy "admins can mark comments as seen"
  on comments for update
  using (is_admin_user())
  with check (is_admin_user());
