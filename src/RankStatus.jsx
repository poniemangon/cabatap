// Sidebar-only: unranked players get this instead of the EloBadge, since
// there's no elo worth showing yet (everyone defaults to 1000 whether
// they've played a ranked duel or not — see ranked_games_played on
// profiles). The (i) is a native title tooltip, same pattern EloBadge uses
// for its tier name.
export default function RankStatus() {
  return (
    <span className="rank-status-none">
      Sin ranking
      <span className="rank-status-info" title="Jugá una partida rankeada para revelar tu rango">
        ⓘ
      </span>
    </span>
  )
}
