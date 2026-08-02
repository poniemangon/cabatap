// Sidebar-only: unranked players get this instead of the EloBadge, since
// there's no elo worth showing yet (everyone defaults to 1000 whether
// they've played a ranked duel or not — see ranked_games_played on
// profiles). Hover/focus on the (i) opens a small custom tooltip instead of
// a native browser title tooltip, so it can carry a real link.
const ELO_WIKI_URL = 'https://es.wikipedia.org/wiki/Sistema_de_puntuaci%C3%B3n_Elo'

export default function RankStatus() {
  return (
    <span className="rank-status-none">
      Sin ranking
      <span className="rank-status-info-wrap" tabIndex={0}>
        <span className="rank-status-info" aria-hidden="true">
          i
        </span>
        <span className="rank-status-tooltip" role="tooltip">
          Jugá una partida rankeada para revelar tu rango.{' '}
          <a href={ELO_WIKI_URL} target="_blank" rel="noopener noreferrer">
            ¿Qué es ELO?
          </a>
        </span>
      </span>
    </span>
  )
}
