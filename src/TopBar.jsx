export default function TopBar({ onShare, shareCopied, onToggleSidebar }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-burger"
          onClick={onToggleSidebar}
          aria-label="Abrir menú"
        >
          ☰
        </button>
        <img src="/favicon.svg" alt="UbiCABA" className="topbar-logo" />
        <span className="topbar-title">
          ubi<span className="topbar-title-accent">CABA</span>
        </span>
      </div>
      <button type="button" className="topbar-share-btn" onClick={onShare}>
        {shareCopied ? '¡Copiado!' : '🔗 Compartir partida'}
      </button>
    </header>
  )
}
