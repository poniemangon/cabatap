// Tiers only reflect ELO earned from 1v1 random-matchmaking duels (see
// apply_duel_elo() in 0021_duel_elo.sql) — private duels and multiplayer
// never move this number. Boundaries are inclusive on the low end, so the
// 1000 starting rating lands in Gold, not Silver.
const TIERS = [
  { name: 'Bronze', max: 500, className: 'elo-bronze' },
  { name: 'Silver', max: 1000, className: 'elo-silver' },
  { name: 'Gold', max: 1500, className: 'elo-gold' },
  { name: 'Platinum', max: 2000, className: 'elo-platinum' },
  { name: 'Master', max: 2500, className: 'elo-master' },
  { name: 'Grandmaster', max: Infinity, className: 'elo-grandmaster' },
]

export function eloTier(elo) {
  return TIERS.find((t) => elo < t.max) ?? TIERS[TIERS.length - 1]
}

export default function EloBadge({ elo }) {
  if (elo == null) return null
  const tier = eloTier(elo)
  return (
    <span className={`elo-badge ${tier.className}`} title={tier.name}>
      <svg viewBox="0 0 24 24" className="elo-badge-icon" aria-hidden="true">
        <path d="M12 2 L20 6 V12 C20 17.5 16.9 21 12 22.5 C7.1 21 4 17.5 4 12 V6 Z" />
      </svg>
      ({elo})
    </span>
  )
}
