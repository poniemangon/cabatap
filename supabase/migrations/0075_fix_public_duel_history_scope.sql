-- Run this manually in the Supabase SQL editor.
--
-- 0074_public_duel_history.sql's policies were too broad: "closed_at is not
-- null" alone made PRIVATE 1v1 duels publicly visible too, contradicting
-- PublicProfilePage.jsx's own on-screen promise ("Los duelos 1 vs 1
-- privados no son visibles para otros jugadores — estas estadísticas solo
-- cuentan lo que es público (duelos rankeados)"). This narrows it to
-- ranked (matchmaking) and multiplayer duels only, dropping and recreating
-- both policies (Postgres has no CREATE OR REPLACE POLICY).

drop policy if exists "closed duels are viewable by everyone" on duels;
create policy "closed duels are viewable by everyone"
  on duels for select
  using (closed_at is not null and (is_multiplayer or matchmaking));

drop policy if exists "results of closed duels are viewable by everyone" on duel_results;
create policy "results of closed duels are viewable by everyone"
  on duel_results for select
  using (
    exists (
      select 1 from duels d
      where d.id = duel_results.duel_id
        and d.closed_at is not null
        and (d.is_multiplayer or d.matchmaking)
    )
  );
