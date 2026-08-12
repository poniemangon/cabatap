import { useCallback, useEffect, useRef, useState } from 'react'
import { getActiveGroupDuel, getGroup, getGroupDailyLeaderboard, getGroupRanking, leaveGroup, updateGroup } from './groupsApi'
import Avatar from '../Avatar'
import DailyWinBadge from '../daily/DailyWinBadge'
import './Groups.css'

const POPUP_WIDTH = 240

function NewDuelInfoIcon() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const iconRef = useRef(null)

  const showPopup = () => {
    const rect = iconRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos({
      top: rect.bottom + 8,
      left: Math.min(Math.max(rect.left + rect.width / 2, POPUP_WIDTH / 2 + 8), window.innerWidth - POPUP_WIDTH / 2 - 8),
    })
    setOpen(true)
  }

  return (
    <span
      ref={iconRef}
      className="group-info-icon"
      tabIndex={0}
      onMouseEnter={showPopup}
      onMouseLeave={() => setOpen(false)}
      onFocus={showPopup}
      onBlur={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation()
        if (open) setOpen(false)
        else showPopup()
      }}
    >
      i
      {open && (
        <span className="group-info-popup" style={{ top: pos.top, left: pos.left }}>
          Los duelos se cierran automáticamente en 6 horas y dan por ganador al primero. Si al pasar 6 horas solo
          jugó una persona, el duelo se elimina.
        </span>
      )}
    </span>
  )
}

function InviteModal({ link, onClose }) {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  const handleCopy = () => {
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  const handleShare = () => {
    navigator.share({ title: 'Unite a mi grupo en UbiCABA', url: link }).catch(() => {})
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="custom-modal groups-modal" onClick={(e) => e.stopPropagation()}>
        <div className="custom-modal-header">
          <span>Invitar al grupo</span>
          <button type="button" className="calendar-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="group-invite-link-row">
          <input
            type="text"
            className="group-invite-link-input"
            value={link}
            readOnly
            onClick={(e) => e.target.select()}
          />
          <button type="button" className="primary-btn secondary-btn" onClick={handleCopy}>
            {copied ? '¡Copiado!' : 'Copiar'}
          </button>
        </div>
        {canShare && (
          <button type="button" className="primary-btn" onClick={handleShare}>
            Compartir
          </button>
        )}
      </div>
    </div>
  )
}

function EditGroupForm({ group, onSaved, onCancel }) {
  const [name, setName] = useState(group.name)
  const [imageUrl, setImageUrl] = useState(group.image_url || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Ponele un nombre al grupo')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const updated = await updateGroup(group.id, { name: name.trim(), imageUrl: imageUrl.trim() })
      onSaved(updated)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form className="groups-form group-edit-form" onSubmit={handleSubmit}>
      <input type="text" placeholder="Nombre del grupo" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        type="text"
        placeholder="URL de la foto (opcional)"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
      />
      {error && <p className="groups-error">{error}</p>}
      <div className="group-edit-form-actions">
        <button type="submit" className="primary-btn secondary-btn" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button type="button" className="primary-btn secondary-btn" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default function GroupDetail({ groupId, profile, onBack, onPlayDuel, onStartDuel, referralAppend }) {
  const [group, setGroup] = useState(null)
  const [ranking, setRanking] = useState([])
  const [dailyLeaderboard, setDailyLeaderboard] = useState([])
  const [activeDuel, setActiveDuel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [starting, setStarting] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([getGroup(groupId), getGroupRanking(groupId), getGroupDailyLeaderboard(groupId), getActiveGroupDuel(groupId)])
      .then(([g, r, dl, d]) => {
        if (!g) {
          setError('No encontramos ese grupo.')
          return
        }
        setGroup(g)
        setRanking(r)
        setDailyLeaderboard(dl)
        setActiveDuel(d)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [groupId])

  useEffect(() => {
    load()
  }, [load])

  const handleStartDuel = async () => {
    setStarting(true)
    try {
      await onStartDuel(groupId)
    } catch (e) {
      setError(e.message)
      setStarting(false)
    }
  }

  const inviteLink = referralAppend(`${window.location.origin}/grupos?invite_id=${group?.invite_id}`)

  const handleLeave = async () => {
    if (!window.confirm('¿Salir de este grupo?')) return
    setLeaving(true)
    try {
      await leaveGroup(groupId, profile.id)
      onBack()
    } catch (e) {
      setError(e.message)
      setLeaving(false)
    }
  }

  if (loading) return <p className="loading-text">Cargando...</p>
  if (error) return <p className="groups-error">{error}</p>
  if (!group) return null

  const isCreator = profile?.id === group.created_by

  return (
    <div className="group-detail">
      <button type="button" className="group-detail-back" onClick={onBack}>
        ← Grupos
      </button>

      {editing ? (
        <EditGroupForm
          group={group}
          onSaved={(updated) => {
            setGroup(updated)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="group-detail-header">
          {group.image_url ? (
            <img src={group.image_url} alt="" className="group-detail-image" />
          ) : (
            <span className="group-detail-image group-card-image-fallback">{group.name.charAt(0).toUpperCase()}</span>
          )}
          <h1 className="group-detail-name">{group.name}</h1>
          {isCreator && (
            <button type="button" className="edit-btn" onClick={() => setEditing(true)}>
              ✏️
            </button>
          )}
        </div>
      )}

      <div className="group-detail-actions">
        <button type="button" className="primary-btn secondary-btn" onClick={() => setInviteOpen(true)}>
          Invitar al grupo
        </button>
        {activeDuel ? (
          <button type="button" className="primary-btn" onClick={() => onPlayDuel(activeDuel.invite_code)}>
            Jugar duelo activo
          </button>
        ) : (
          <span className="group-new-duel-wrap">
            <button type="button" className="primary-btn" onClick={handleStartDuel} disabled={starting}>
              {starting ? 'Creando...' : 'Nuevo duelo'}
            </button>
            <NewDuelInfoIcon />
          </span>
        )}
        <button type="button" className="primary-btn secondary-btn group-leave-btn" onClick={handleLeave} disabled={leaving}>
          {leaving ? 'Saliendo...' : 'Salir del grupo'}
        </button>
      </div>

      <h2 className="group-detail-ranking-title">Ranking — duelos ganados</h2>
      <ul className="group-ranking-list">
        {ranking.map((m, i) => (
          <li key={m.id} className={`group-ranking-row${m.id === profile?.id ? ' group-ranking-row-me' : ''}`}>
            <span className="group-ranking-rank">#{i + 1}</span>
            <Avatar src={m.avatar_url} baseClass="group-ranking-avatar" />
            <span className="group-ranking-name">
              {m.id === profile?.id ? 'Vos' : m.username}
              <DailyWinBadge count={m.dailyWins} />
            </span>
            <span className="group-ranking-wins">{m.wins} 🏆</span>
          </li>
        ))}
      </ul>

      <h2 className="group-detail-ranking-title">Mapa del día de hoy</h2>
      <p className="group-detail-hint">Jugá modo tranqui para competir por el mapa del día.</p>
      {dailyLeaderboard.length === 0 ? (
        <p className="groups-empty">Todavía nadie del grupo jugó el mapa del día de hoy.</p>
      ) : (
        <ul className="group-ranking-list">
          {dailyLeaderboard.map((r, i) => (
            <li
              key={r.profile_id}
              className={`group-ranking-row${r.profile_id === profile?.id ? ' group-ranking-row-me' : ''}`}
            >
              <span className="group-ranking-rank">#{i + 1}</span>
              <Avatar src={r.profile?.avatar_url} baseClass="group-ranking-avatar" />
              <span className="group-ranking-name">{r.profile_id === profile?.id ? 'Vos' : r.profile?.username}</span>
              <span className="group-ranking-wins">{r.total_score} pts</span>
            </li>
          ))}
        </ul>
      )}

      {inviteOpen && <InviteModal link={inviteLink} onClose={() => setInviteOpen(false)} />}
    </div>
  )
}
