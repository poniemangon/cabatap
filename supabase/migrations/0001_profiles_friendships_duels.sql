-- Run this manually in the Supabase SQL editor for the UbiCABA project.
-- Prerequisite: Clerk must already be configured as a Supabase Third-Party
-- Auth provider (Supabase Dashboard > Authentication > Sign In / Providers >
-- Third Party Auth > Clerk). That's what makes auth.jwt() below resolve to
-- the signed-in Clerk user's claims.

create or replace function requesting_user_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt()->>'sub', '')
$$;

-- profiles ------------------------------------------------------------

create table profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  username text unique not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles are viewable by everyone"
  on profiles for select
  using (true);

create policy "users can insert their own profile"
  on profiles for insert
  with check (clerk_user_id = requesting_user_id());

create policy "users can update their own profile"
  on profiles for update
  using (clerk_user_id = requesting_user_id());

-- friendships -----------------------------------------------------------

create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index friendships_requester_idx on friendships (requester_id);
create index friendships_addressee_idx on friendships (addressee_id);

alter table friendships enable row level security;

create policy "participants can view their friendships"
  on friendships for select
  using (
    exists (
      select 1 from profiles p
      where p.clerk_user_id = requesting_user_id()
        and p.id in (friendships.requester_id, friendships.addressee_id)
    )
  );

create policy "users can send friend requests"
  on friendships for insert
  with check (
    exists (
      select 1 from profiles p
      where p.id = friendships.requester_id
        and p.clerk_user_id = requesting_user_id()
    )
  );

create policy "participants can update their friendships"
  on friendships for update
  using (
    exists (
      select 1 from profiles p
      where p.clerk_user_id = requesting_user_id()
        and p.id in (friendships.requester_id, friendships.addressee_id)
    )
  );

-- duels -------------------------------------------------------------------
-- No status column: pending / one-side-played / completed is derived from
-- how many duel_results rows exist for a given duel.

create table duels (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  challenger_id uuid not null references profiles(id) on delete cascade,
  opponent_id uuid references profiles(id) on delete cascade,
  round_indices int[] not null,
  barrio_ids int[],
  created_at timestamptz not null default now()
);

create index duels_challenger_idx on duels (challenger_id);
create index duels_opponent_idx on duels (opponent_id);

alter table duels enable row level security;

create policy "participants or unclaimed invites are viewable"
  on duels for select
  using (
    opponent_id is null
    or exists (
      select 1 from profiles p
      where p.clerk_user_id = requesting_user_id()
        and p.id in (duels.challenger_id, duels.opponent_id)
    )
  );

create policy "users can create duels as challenger"
  on duels for insert
  with check (
    exists (
      select 1 from profiles p
      where p.id = duels.challenger_id
        and p.clerk_user_id = requesting_user_id()
    )
  );

create policy "users can claim an unclaimed duel invite"
  on duels for update
  using (opponent_id is null)
  with check (
    exists (
      select 1 from profiles p
      where p.id = opponent_id
        and p.clerk_user_id = requesting_user_id()
    )
  );

-- duel_results --------------------------------------------------------------

create table duel_results (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references duels(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  results jsonb not null,
  total_score int not null,
  completed_at timestamptz not null default now(),
  unique (duel_id, profile_id)
);

create index duel_results_duel_idx on duel_results (duel_id);

alter table duel_results enable row level security;

create policy "duel participants can view results"
  on duel_results for select
  using (
    exists (
      select 1 from duels d
      join profiles p on p.clerk_user_id = requesting_user_id()
      where d.id = duel_results.duel_id
        and p.id in (d.challenger_id, d.opponent_id)
    )
  );

create policy "users can submit their own duel result"
  on duel_results for insert
  with check (
    exists (
      select 1 from profiles p
      where p.id = duel_results.profile_id
        and p.clerk_user_id = requesting_user_id()
    )
    and exists (
      select 1 from duels d
      where d.id = duel_results.duel_id
        and (d.challenger_id = duel_results.profile_id or d.opponent_id = duel_results.profile_id)
    )
  );
