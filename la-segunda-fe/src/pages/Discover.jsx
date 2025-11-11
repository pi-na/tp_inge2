
import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import EventCard from '../components/EventCard.jsx'

const CATS = ["deportes","cultural","gastronomia","turismo","networking"]

export default function Discover() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [distance, setDistance] = useState('') // km
  const [coords, setCoords] = useState(null)

  useEffect(()=>{
    refresh()
    // eslint-disable-next-line
  }, [coords, category])

  async function refresh() {
    setLoading(true)
    try {
      let url = '/events?activo=1'
      if (q) url += `&q=${encodeURIComponent(q)}`
      if (category) url += `&category=${encodeURIComponent(category)}`
      if (coords) {
        url += `&lat=${coords.lat}&lng=${coords.lng}`
        if (distance) url += `&max_km=${distance}`
      }
      const data = await api.get(url)
      setEvents(data)
    } finally {
      setLoading(false)
    }
  }

  function getLocation() {
    if (!navigator.geolocation) return alert('Geolocalización no disponible')
    navigator.geolocation.getCurrentPosition(
      (pos)=>{
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err)=> alert('No se pudo obtener ubicación: ' + err.message),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <input className="border rounded px-3 py-2 sm:col-span-2" placeholder="Buscar por título..." value={q} onChange={e=>setQ(e.target.value)} />
          <select className="border rounded px-3 py-2" value={category} onChange={e=>setCategory(e.target.value)}>
            <option value="">Todas las categorías</option>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex gap-2">
            <input className="border rounded px-3 py-2 w-full" placeholder="Distancia (km)" value={distance} onChange={e=>setDistance(e.target.value)} />
            <button className="px-3 py-2 rounded border" onClick={getLocation}>Mi ubicación</button>
          </div>
          <button className="px-3 py-2 rounded bg-sky-500 text-white" onClick={refresh}>Actualizar</button>
        </div>
      </div>

      {loading && <div>Cargando…</div>}
      {!loading && events.length === 0 && <div className="text-gray-600">No hay eventos con esos filtros.</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {events.map(ev => <EventCard key={ev.id} ev={ev} />)}
      </div>
    </div>
  )
}
