export default function TopBar({ onShare, shareCopied }) {
  return (
    <header className="topbar">
      <img src="/favicon.svg" alt="UbiCABA" className="topbar-logo" />
      <button type="button" className="topbar-share-btn" onClick={onShare}>
        {shareCopied ? '¡Copiado!' : '🔗 Compartir partida'}
      </button>
    </header>
  )
}
