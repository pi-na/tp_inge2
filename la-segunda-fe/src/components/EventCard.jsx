
import { Link } from 'react-router-dom'

export default function EventCard({ ev, isOwner = false }) {
  return (
    <Link 
      to={`/events/${ev.id}`} 
      className={`block rounded-xl border p-4 hover:shadow-sm transition ${
        isOwner 
          ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' 
          : 'bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{ev.title}</h3>
          {isOwner && (
            <span className="text-xs rounded-full bg-blue-500 text-white px-2 py-0.5 font-medium">
              Tu evento
            </span>
          )}
        </div>
        <span className="text-xs rounded-full border px-2 py-0.5">{ev.category}</span>
      </div>
      <div className="text-xs text-gray-600 mt-1">
        {new Date(ev.fecha_inicio).toLocaleString()} → {new Date(ev.fecha_fin).toLocaleString()}
      </div>
      {!!ev.location_alias && (
        <div className="text-xs text-gray-700 mt-1">📍 {ev.location_alias}</div>
      )}
      <div className="text-xs text-gray-600 mt-1">
        Por: {ev.organizer_name ? (
          <span>{ev.organizer_name}{ev.organizer_rating !== undefined ? `(${ev.organizer_rating.toFixed(1)})` : ''}</span>
        ) : (
          <span className="font-mono">{ev.organizer_id?.slice(0,8)}…</span>
        )}
      </div>
      {typeof ev.distance_meters === 'number' && (
        <div className="text-xs text-gray-500 mt-1">{(ev.distance_meters/1000).toFixed(1)} km</div>
      )}
      {ev.description && <p className="text-sm text-gray-700 mt-2 line-clamp-2">{ev.description}</p>}
    </Link>
  )
}
