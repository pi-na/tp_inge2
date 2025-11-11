
import { Link } from 'react-router-dom'

export default function EventCard({ ev }) {
  return (
    <Link to={`/events/${ev.id}`} className="block rounded-xl border bg-white p-4 hover:shadow-sm transition">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{ev.title}</h3>
        <span className="text-xs rounded-full border px-2 py-0.5">{ev.category}</span>
      </div>
      <div className="text-xs text-gray-600 mt-1">
        {new Date(ev.fecha_inicio).toLocaleString()} → {new Date(ev.fecha_fin).toLocaleString()}
      </div>
      {!!ev.location_alias && (
        <div className="text-xs text-gray-700 mt-1">📍 {ev.location_alias}</div>
      )}
      {typeof ev.distance_meters === 'number' && (
        <div className="text-xs text-gray-500 mt-1">{(ev.distance_meters/1000).toFixed(1)} km</div>
      )}
      {ev.description && <p className="text-sm text-gray-700 mt-2 line-clamp-2">{ev.description}</p>}
    </Link>
  )
}
