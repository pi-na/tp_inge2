
import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function Profile() {
  const [user, setUser] = useState(null)
  const [err, setErr] = useState('')

  async function load() {
    try {
      setErr('')
      const u = await api.get('/users/me')
      setUser(u)
    } catch (e) {
      setErr('Necesitás setear X-User-Id (arriba a la derecha).')
    }
  }
  useEffect(()=>{ load() }, [])

  async function save() {
    const payload = { 
      name: user.name, 
      rating: user.rating,
      phone: user.phone || '',
      description: user.description || ''
    }
    const u = await api.patch('/users/me', payload)
    setUser(u)
    alert('Guardado')
  }

  if (err) return <div className="text-red-600">{err}</div>
  if (!user) return <div>Cargando…</div>

  return (
    <div className="max-w-lg w-full space-y-3 sm:space-y-4">
      <div className="rounded-xl border bg-white p-3 sm:p-4 space-y-3">
        <div className="text-xs sm:text-sm text-gray-600 break-all">ID: <span className="font-mono">{user.id}</span></div>
        <label className="block text-xs sm:text-sm font-medium">Nombre</label>
        <input className="border rounded px-3 py-2 w-full text-sm sm:text-base" value={user.name || ''} onChange={e=>setUser({...user, name: e.target.value})} />
        <label className="block text-xs sm:text-sm font-medium">Teléfono</label>
        <input className="border rounded px-3 py-2 w-full text-sm sm:text-base" value={user.phone || ''} onChange={e=>setUser({...user, phone: e.target.value})} placeholder="Ej: +54 11 1234-5678" />
        <label className="block text-xs sm:text-sm font-medium">Descripción</label>
        <textarea className="border rounded px-3 py-2 w-full text-sm sm:text-base" rows="3" value={user.description || ''} onChange={e=>setUser({...user, description: e.target.value})} placeholder="Escribe algo sobre ti..." />
        <label className="block text-xs sm:text-sm font-medium">Rating (0–5)</label>
        <input type="number" min="0" max="5" step="0.1" className="border rounded px-3 py-2 w-full text-sm sm:text-base" value={user.rating} onChange={e=>setUser({...user, rating: Number(e.target.value)})} />
        <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
          <div className="rounded-lg bg-gray-50 p-2 sm:p-3">
            <div className="text-xs text-gray-500">Visitados</div>
            <div className="font-semibold text-sm sm:text-base">{user.cant_events_visited}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-2 sm:p-3">
            <div className="text-xs text-gray-500">Organizados</div>
            <div className="font-semibold text-sm sm:text-base">{user.cant_events_organized}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-2 sm:p-3">
            <div className="text-xs text-gray-500">No‑shows</div>
            <div className="font-semibold text-sm sm:text-base">{user.cant_no_shows}</div>
          </div>
        </div>
        <button className="px-4 py-2 rounded bg-sky-600 text-white text-sm sm:text-base w-full sm:w-auto" onClick={save}>Guardar</button>
      </div>
    </div>
  )
}
