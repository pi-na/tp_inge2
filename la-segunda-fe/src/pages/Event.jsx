
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { getUserId } from '../lib/auth.js'

function Chip({children}) {
  return <span className="text-xs rounded-full border px-2 py-0.5">{children}</span>
}

function UserName({userId, name, rating}) {
  if (name && rating !== undefined) {
    return <span>{name}({rating.toFixed(1)})</span>
  }
  return <span className="font-mono text-sm">{userId?.slice(0,8)}…</span>
}

export default function Event() {
  const { id } = useParams()
  const nav = useNavigate()
  const [ev, setEv] = useState(null)
  const [pending, setPending] = useState([])
  const [confirmed, setConfirmed] = useState([])
  const [pendingUsers, setPendingUsers] = useState({})
  const [confirmedUsers, setConfirmedUsers] = useState({})
  const [userStatus, setUserStatus] = useState(null) // 'pending', 'confirmed', null

  async function load() {
    const data = await api.get(`/events/${id}`)
    setEv(data)
    setPending(data.pending_approval_participants || [])
    setConfirmed(data.confirmed_participants || [])
    
    // Determinar estado del usuario actual
    const currentUserId = getUserId()
    if (currentUserId) {
      if (data.confirmed_participants.includes(currentUserId)) {
        setUserStatus('confirmed')
      } else if (data.pending_approval_participants.includes(currentUserId)) {
        setUserStatus('pending')
      } else {
        setUserStatus(null)
      }
    }

    // Cargar información de usuarios pendientes
    if (data.pending_approval_participants.length > 0) {
      try {
        const users = await api.post('/users/batch', data.pending_approval_participants)
        const usersMap = {}
        users.forEach(u => { usersMap[u.id] = u })
        setPendingUsers(usersMap)
      } catch (e) {
        console.error('Error cargando usuarios pendientes:', e)
      }
    }

    // Cargar información de usuarios confirmados
    if (data.confirmed_participants.length > 0) {
      try {
        const users = await api.post('/users/batch', data.confirmed_participants)
        const usersMap = {}
        users.forEach(u => { usersMap[u.id] = u })
        setConfirmedUsers(usersMap)
      } catch (e) {
        console.error('Error cargando usuarios confirmados:', e)
      }
    }
  }
  useEffect(()=>{ load() }, [id])

  if (!ev) return <div>Cargando…</div>

  async function apply() {
    await api.post(`/events/${id}/apply`)
    alert('Te postulaste al evento. Esperando confirmación del organizador.')
    await load()
  }

  async function cancel() {
    await api.patch(`/events/${id}/cancel`)
    await load()
  }

  async function del() {
    await api.del(`/events/${id}`)
    alert('Evento eliminado')
    nav('/')
  }

  async function complete() {
    if (!confirm('¿Marcar este evento como finalizado? Esto actualizará las estadísticas de los participantes.')) {
      return
    }
    try {
      await api.post(`/events/${id}/complete`)
      alert('Evento marcado como finalizado')
      await load()
    } catch (e) {
      alert('Error: ' + (e.message || 'No se pudo finalizar el evento'))
    }
  }

  async function accept(uid) {
    await api.post(`/events/${id}/accept`, { user_id: uid })
    await load()
  }
  async function reject(uid, blacklist=false) {
    await api.post(`/events/${id}/reject`, { user_id: uid, blacklist })
    await load()
  }

  function openInMaps() {
    const url = `https://www.google.com/maps?q=${ev.location.lat},${ev.location.lng}`
    window.open(url, '_blank')
  }

  const isOrganizer = Boolean(getUserId() === ev.organizer_id)
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${ev.location.lng-0.01},${ev.location.lat-0.01},${ev.location.lng+0.01},${ev.location.lat+0.01}&layer=mapnik&marker=${ev.location.lat},${ev.location.lng}`

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4 space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{ev.title}</h2>
          <Chip>{ev.category}</Chip>
          <Chip>estado: {ev.activo===1?'activo': ev.activo===2?'cancelado':'eliminado'}</Chip>
          {ev.finalizado && <Chip className="bg-green-100 text-green-800 border-green-300">finalizado</Chip>}
        </div>
        
        {/* Card de espera de confirmación */}
        {!isOrganizer && userStatus === 'pending' && (
          <div className="mt-3 rounded-lg border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 shadow-md">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 mb-1">
                  Solicitud pendiente
                </p>
                <p className="text-sm text-amber-800">
                  Solicitaste participar en este evento. Esperando que <span className="font-semibold">{ev.organizer_name || 'el organizador'}</span> acepte tu solicitud.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="text-sm text-gray-600">{new Date(ev.fecha_inicio).toLocaleString()} → {new Date(ev.fecha_fin).toLocaleString()}</div>
        {!!ev.location_alias && <div className="text-sm">📍 {ev.location_alias}</div>}
        {ev.description && <p className="text-sm mt-2">{ev.description}</p>}
        <div className="text-sm text-gray-600 flex items-center gap-2">
          <span>Organizador: {ev.organizer_name ? (
            <span>{ev.organizer_name}{ev.organizer_rating !== undefined ? `(${ev.organizer_rating.toFixed(1)})` : ''}</span>
          ) : (
            <span className="font-mono">{ev.organizer_id.slice(0,8)}…</span>
          )}</span>
          <Link 
            to={`/users/${ev.organizer_id}`}
            className="text-xs px-2 py-1 rounded border bg-blue-50 hover:bg-blue-100 text-blue-700"
          >
            Ver perfil
          </Link>
        </div>
      </div>

      {/* Mapa */}
      <div className="rounded-xl border bg-white p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Ubicación</h3>
          <button onClick={openInMaps} className="px-3 py-1 rounded border text-sm">Abrir en mapas</button>
        </div>
        <div className="w-full h-64 rounded overflow-hidden">
          <iframe
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            marginHeight="0"
            marginWidth="0"
            src={mapUrl}
            style={{ border: 0 }}
            allowFullScreen
          />
        </div>
      </div>

      {/* Participantes confirmados */}
      {confirmed.length > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <h3 className="font-semibold mb-2">Participantes confirmados ({confirmed.length})</h3>
          <ul className="space-y-2">
            {confirmed.map(uid => {
              const user = confirmedUsers[uid]
              return (
                <li key={uid} className="flex items-center justify-between text-sm">
                  <UserName userId={uid} name={user?.name} rating={user?.rating} />
                  <Link 
                    to={`/users/${uid}`}
                    className="text-xs px-2 py-1 rounded border bg-blue-50 hover:bg-blue-100 text-blue-700"
                  >
                    Ver perfil
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {isOrganizer ? (
          <>
            {ev.activo===1 && !ev.finalizado && (
              <button 
                className="px-4 py-2 rounded-md font-medium text-white shadow-md hover:shadow-lg transition-all" 
                style={{ backgroundColor: '#16a34a', border: 'none' }}
                onClick={complete}
              >
                ✓ Marcar como finalizado
              </button>
            )}
            {ev.activo===1 && !ev.finalizado && (
              <button 
                className="px-4 py-2 rounded-md font-medium border-2 border-gray-300 hover:bg-gray-50 transition-all" 
                onClick={cancel}
              >
                Cancelar evento
              </button>
            )}
            {ev.finalizado && (
              <div className="px-4 py-2 rounded-md font-medium text-white shadow-md" style={{ backgroundColor: '#16a34a' }}>
                ✓ Evento finalizado
              </div>
            )}
            <button 
              className="px-4 py-2 rounded-md font-medium border-2 border-red-300 text-red-600 hover:bg-red-50 transition-all" 
              onClick={del}
            >
              Eliminar evento
            </button>
          </>
        ) : (
          <>
            {ev.activo===1 && userStatus === null && (
              <button className="px-3 py-2 rounded bg-sky-600 text-white" onClick={apply}>Postularme</button>
            )}
            {userStatus === 'pending' && (
              <div className="px-3 py-2 rounded bg-yellow-100 text-yellow-800">
                Esperando confirmación
              </div>
            )}
            {userStatus === 'confirmed' && (
              <div className="px-3 py-2 rounded bg-green-100 text-green-800">
                Participación confirmada
              </div>
            )}
          </>
        )}
      </div>

      {isOrganizer && (
        <div className="rounded-xl border bg-white p-4">
          <h3 className="font-semibold mb-2">Pendientes de aprobación</h3>
          {pending.length===0 ? <div className="text-sm text-gray-600">No hay pendientes.</div> : (
            <ul className="space-y-2">
              {pending.map(uid => {
                const user = pendingUsers[uid]
                return (
                  <li key={uid} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserName userId={uid} name={user?.name} rating={user?.rating} />
                      <Link 
                        to={`/users/${uid}`}
                        className="text-xs px-2 py-1 rounded border bg-blue-50 hover:bg-blue-100 text-blue-700"
                      >
                        Ver perfil
                      </Link>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 rounded border" onClick={()=>accept(uid)}>Aceptar</button>
                      <button className="px-3 py-1 rounded border" onClick={()=>reject(uid,false)}>Rechazar</button>
                      <button className="px-3 py-1 rounded border" onClick={()=>reject(uid,true)}>Rechazar + blacklist</button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
