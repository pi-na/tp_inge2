
import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import EventCard from '../components/EventCard.jsx'
import { getUserId } from '../lib/auth.js'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix para iconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const CATS = ["deportes","cultural","gastronomia","turismo","networking"]

export default function Discover() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [distance, setDistance] = useState('') // km
  const [coords, setCoords] = useState(null)
  const [locationError, setLocationError] = useState(null)

  // Obtener ubicación automáticamente al cargar
  useEffect(()=>{
    const DEFAULT_COORDS = { lat: -34.6058, lng: -58.3739 }
    if (!navigator.geolocation) {
      setLocationError('Geolocalización no disponible, usando ubicación por defecto')
      setCoords(DEFAULT_COORDS)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos)=>{
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationError(null)
      },
      (err)=> {
        setLocationError('No se pudo obtener ubicación, usando ubicación por defecto: ' + err.message)
        setCoords(DEFAULT_COORDS)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [])

  useEffect(()=>{
    if (coords) {
      refresh()
    }
    // eslint-disable-next-line
  }, [coords, category])

  async function refresh() {
    setLoading(true)
    try {
      let url = '/events?activo=1'
      if (q) url += `&q=${encodeURIComponent(q)}`
      if (category) url += `&category=${encodeURIComponent(category)}`
      // Siempre usar coordenadas si están disponibles para ordenar por distancia
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
    const DEFAULT_COORDS = { lat: -34.6058, lng: -58.3739 }
    if (!navigator.geolocation) {
      setLocationError('Geolocalización no disponible, usando ubicación por defecto')
      setCoords(DEFAULT_COORDS)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos)=>{
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationError(null)
      },
      (err)=> {
        setLocationError('No se pudo obtener ubicación, usando ubicación por defecto: ' + err.message)
        setCoords(DEFAULT_COORDS)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  // Componente para ajustar el mapa cuando cambian las coordenadas
  function MapUpdater({ coords }) {
    const map = useMap()
    useEffect(() => {
      if (!coords) return
      
      // Forzar invalidación del tamaño del mapa para asegurar renderizado correcto
      setTimeout(() => {
        map.invalidateSize()
      }, 100)
      
      // Siempre centrar en la ubicación del usuario con zoom cercano
      map.setView([coords.lat, coords.lng], 15)
    }, [map, coords])
    return null
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="rounded-xl border bg-white p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
          <input className="border rounded px-3 py-2 text-sm sm:text-base sm:col-span-2" placeholder="Buscar por título..." value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter' && refresh()} />
          <select className="border rounded px-3 py-2 text-sm sm:text-base" value={category} onChange={e=>setCategory(e.target.value)}>
            <option value="">Todas las categorías</option>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex flex-col sm:flex-row gap-2 sm:col-span-2 lg:col-span-1">
            <input className="border rounded px-3 py-2 text-sm sm:text-base flex-1" placeholder="Distancia (km)" value={distance} onChange={e=>setDistance(e.target.value)} onKeyDown={e=>e.key==='Enter' && refresh()} />
            <button className="px-3 py-2 rounded border text-sm sm:text-base whitespace-nowrap" onClick={getLocation}>📍 Ubicación</button>
          </div>
          <button className="px-3 py-2 rounded bg-sky-500 text-white text-sm sm:text-base sm:col-span-2 lg:col-span-1" onClick={refresh}>Actualizar</button>
        </div>
        {locationError && (
          <div className="text-xs text-red-600 mt-2">{locationError}</div>
        )}
        {coords && (
          <div className="text-xs text-gray-600 mt-2 break-words">
            Ubicación: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)} • Eventos ordenados por distancia
          </div>
        )}
      </div>

      {loading && <div>Cargando…</div>}
      {!loading && events.length === 0 && <div className="text-gray-600">No hay eventos con esos filtros.</div>}

      {/* Cards de eventos scrolleables */}
      {events.length > 0 && (
        <div className="rounded-xl border bg-white p-3 sm:p-4">
          <h3 className="font-semibold text-sm sm:text-base mb-3">Eventos encontrados ({events.length})</h3>
          <div className="overflow-x-auto pb-2 -mx-3 sm:-mx-4 px-3 sm:px-4">
            <div className="flex gap-3 sm:gap-4" style={{ minWidth: 'max-content' }}>
              {events.map(ev => {
                const userId = getUserId()
                // Comparar como strings para asegurar que funcione
                const isOwner = Boolean(userId && ev.organizer_id && String(userId) === String(ev.organizer_id))
                return (
                  <div key={ev.id} className="flex-shrink-0" style={{ width: 'min(280px, 85vw)' }}>
                    <EventCard ev={ev} isOwner={isOwner} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mapa */}
      {coords && (
        <div className="rounded-xl border bg-white p-3 sm:p-4">
          <h3 className="font-semibold text-sm sm:text-base mb-2">Mapa de eventos</h3>
          <div className="w-full h-48 sm:h-64 rounded overflow-hidden relative">
            <MapContainer
              center={[coords.lat, coords.lng]}
              zoom={15}
              style={{ height: '100%', width: '100%', minHeight: '192px' }}
              scrollWheelZoom={true}
              key={`map-${coords.lat}-${coords.lng}`}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {/* Marcador de ubicación del usuario */}
              <Marker position={[coords.lat, coords.lng]}>
                <Popup>Tu ubicación</Popup>
              </Marker>
              {/* Marcadores de eventos */}
              {events.map((ev) => (
                <Marker key={ev.id} position={[ev.location.lat, ev.location.lng]}>
                  <Popup>
                    <div className="text-sm">
                      <strong>{ev.title}</strong>
                      <br />
                      {ev.location_alias && <span>📍 {ev.location_alias}</span>}
                      {typeof ev.distance_meters === 'number' && (
                        <div className="text-xs text-gray-600">
                          {(ev.distance_meters/1000).toFixed(1)} km
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
              <MapUpdater coords={coords} />
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  )
}
