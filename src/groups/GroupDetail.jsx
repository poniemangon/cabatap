import { useCallback, useEffect, useState } from 'react'
import { getActiveGroupDuel, getGroup, getGroupDailyLeaderboard, getGroupRanking, leaveGroup, updateGroup } from './groupsApi'
import Avatar from '../Avatar'
import DailyWinBadge from '../daily/DailyWinBadge'
import './Groups.css'

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
  const [inviteCopied, setInviteCopied] = useState(false)
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

  const handleInvite = () => {
    const link = referralAppend(`${window.location.origin}/grupos?group_id=${groupId}`)
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setInviteCopied(true)
        setTimeout(() => setInviteCopied(false), 2000)
      })
      .catch(() => {})
  }

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
            <span className="group-detail-image group-card-image-fallback">Sin grupo</span>
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
        <button type="button" className="primary-btn secondary-btn" onClick={handleInvite}>
          {inviteCopied ? '¡Copiado!' : 'Invitar al grupo'}
        </button>
        {activeDuel ? (
          <button type="button" className="primary-btn" onClick={() => onPlayDuel(activeDuel.invite_code)}>
            Jugar duelo activo
          </button>
        ) : (
          <button type="button" className="primary-btn" onClick={handleStartDuel} disabled={starting}>
            {starting ? 'Creando...' : 'Nuevo duelo'}
          </button>
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
    </div>
  )
}
