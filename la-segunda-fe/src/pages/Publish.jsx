
import { useState } from 'react'
import { api } from '../lib/api.js'

const CATS = ["deportes","cultural","gastronomia","turismo","networking"]

export default function Publish() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [fecha_inicio, setFI] = useState('')
  const [fecha_fin, setFF] = useState('')
  const [category, setCategory] = useState(CATS[0])
  const [location_alias, setAlias] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')

  function pickLocation() {
    if (!navigator.geolocation) return alert('Geolocalización no disponible')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(String(pos.coords.latitude))
        setLng(String(pos.coords.longitude))
      },
      err => alert('No se pudo obtener ubicación: ' + err.message),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  async function submit(e) {
    e.preventDefault()
    if (!title || !fecha_inicio || !fecha_fin || !lat || !lng) {
      return alert('Completá título, fechas y ubicación')
    }
    const body = {
      title,
      description: description || undefined,
      fecha_inicio: new Date(fecha_inicio).toISOString(),
      fecha_fin: new Date(fecha_fin).toISOString(),
      location: { lat: Number(lat), lng: Number(lng) },
      location_alias: location_alias || undefined,
      category,
    }
    const ev = await api.post('/events', body)
    alert('Evento creado: ' + ev.id)
    setTitle(''); setDescription(''); setFI(''); setFF(''); setAlias(''); setLat(''); setLng('');
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Título" value={title} onChange={e=>setTitle(e.target.value)} />
          <select className="border rounded px-3 py-2" value={category} onChange={e=>setCategory(e.target.value)}>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="border rounded px-3 py-2" placeholder="Alias de ubicación (opcional)" value={location_alias} onChange={e=>setAlias(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Descripción (opcional)" value={description} onChange={e=>setDescription(e.target.value)} />
          <input type="datetime-local" className="border rounded px-3 py-2" value={fecha_inicio} onChange={e=>setFI(e.target.value)} />
          <input type="datetime-local" className="border rounded px-3 py-2" value={fecha_fin} onChange={e=>setFF(e.target.value)} />
          <div className="flex gap-2">
            <input className="border rounded px-3 py-2 w-full" placeholder="Lat" value={lat} onChange={e=>setLat(e.target.value)} />
            <input className="border rounded px-3 py-2 w-full" placeholder="Lng" value={lng} onChange={e=>setLng(e.target.value)} />
            <button type="button" className="px-3 py-2 rounded border" onClick={pickLocation}>Mi ubicación</button>
          </div>
        </div>
      </div>
      <button className="px-4 py-2 rounded bg-sky-600 text-white">Publicar</button>
    </form>
  )
}
