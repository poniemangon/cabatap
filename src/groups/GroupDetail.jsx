import { useCallback, useEffect, useState } from 'react'
import { getActiveGroupDuel, getGroup, getGroupRanking } from './groupsApi'
import Avatar from '../Avatar'
import './Groups.css'

export default function GroupDetail({ groupId, profile, onBack, onPlayDuel, onStartDuel, referralAppend }) {
  const [group, setGroup] = useState(null)
  const [ranking, setRanking] = useState([])
  const [activeDuel, setActiveDuel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [starting, setStarting] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([getGroup(groupId), getGroupRanking(groupId), getActiveGroupDuel(groupId)])
      .then(([g, r, d]) => {
        if (!g) {
          setError('No encontramos ese grupo.')
          return
        }
        setGroup(g)
        setRanking(r)
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

  if (loading) return <p className="loading-text">Cargando...</p>
  if (error) return <p className="groups-error">{error}</p>
  if (!group) return null

  return (
    <div className="group-detail">
      <button type="button" className="group-detail-back" onClick={onBack}>
        ← Grupos
      </button>

      <div className="group-detail-header">
        {group.image_url ? (
          <img src={group.image_url} alt="" className="group-detail-image" />
        ) : (
          <span className="group-detail-image group-card-image-fallback">Sin grupo</span>
        )}
        <h1 className="group-detail-name">{group.name}</h1>
      </div>

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
      </div>

      <h2 className="group-detail-ranking-title">Ranking — duelos ganados</h2>
      <ul className="group-ranking-list">
        {ranking.map((m, i) => (
          <li key={m.id} className={`group-ranking-row${m.id === profile?.id ? ' group-ranking-row-me' : ''}`}>
            <span className="group-ranking-rank">#{i + 1}</span>
            <Avatar src={m.avatar_url} baseClass="group-ranking-avatar" />
            <span className="group-ranking-name">{m.id === profile?.id ? 'Vos' : m.username}</span>
            <span className="group-ranking-wins">{m.wins} 🏆</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
