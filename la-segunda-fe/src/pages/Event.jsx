
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'

function Chip({children}) {
  return <span className="text-xs rounded-full border px-2 py-0.5">{children}</span>
}

export default function Event() {
  const { id } = useParams()
  const nav = useNavigate()
  const [ev, setEv] = useState(null)
  const [pending, setPending] = useState([])

  async function load() {
    const data = await api.get(`/events/${id}`)
    setEv(data)
    setPending(data.pending_approval_participants || [])
  }
  useEffect(()=>{ load() }, [id])

  if (!ev) return <div>Cargando…</div>

  async function apply() {
    await api.post(`/events/${id}/apply`)
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

  async function accept(uid) {
    await api.post(`/events/${id}/accept`, { user_id: uid })
    await load()
  }
  async function reject(uid, blacklist=false) {
    await api.post(`/events/${id}/reject`, { user_id: uid, blacklist })
    await load()
  }

  const isOrganizer = Boolean(localStorage.getItem('userId') === ev.organizer_id)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4 space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{ev.title}</h2>
          <Chip>{ev.category}</Chip>
          <Chip>estado: {ev.activo===1?'activo': ev.activo===2?'cancelado':'eliminado'}</Chip>
        </div>
        <div className="text-sm text-gray-600">{new Date(ev.fecha_inicio).toLocaleString()} → {new Date(ev.fecha_fin).toLocaleString()}</div>
        {!!ev.location_alias && <div className="text-sm">📍 {ev.location_alias}</div>}
        {ev.description && <p className="text-sm mt-2">{ev.description}</p>}
        <div className="text-xs text-gray-600">Organizer: <span className="font-mono">{ev.organizer_id}</span></div>
      </div>

      <div className="flex gap-2">
        {isOrganizer ? (
          <>
            {ev.activo===1 && <button className="px-3 py-2 rounded border" onClick={cancel}>Cancelar</button>}
            <button className="px-3 py-2 rounded border" onClick={del}>Eliminar</button>
          </>
        ) : (
          <>
            {ev.activo===1 && <button className="px-3 py-2 rounded bg-sky-600 text-white" onClick={apply}>Postularme</button>}
          </>
        )}
      </div>

      {isOrganizer && (
        <div className="rounded-xl border bg-white p-4">
          <h3 className="font-semibold mb-2">Pendientes de aprobación</h3>
          {pending.length===0 ? <div className="text-sm text-gray-600">No hay pendientes.</div> : (
            <ul className="space-y-2">
              {pending.map(uid => (
                <li key={uid} className="flex items-center justify-between">
                  <span className="font-mono text-sm">{uid}</span>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 rounded border" onClick={()=>accept(uid)}>Aceptar</button>
                    <button className="px-3 py-1 rounded border" onClick={()=>reject(uid,false)}>Rechazar</button>
                    <button className="px-3 py-1 rounded border" onClick={()=>reject(uid,true)}>Rechazar + blacklist</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
