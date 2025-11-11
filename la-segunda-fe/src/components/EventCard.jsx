
import { Link } from 'react-router-dom'

export default function EventCard({ ev, isOwner = false }) {
  return (
    <Link 
      to={`/events/${ev.id}`} 
      className={`block rounded-xl border p-3 sm:p-4 hover:shadow-sm transition ${
        isOwner 
          ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' 
          : 'bg-white'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
          <h3 className="font-medium text-sm sm:text-base truncate">{ev.title}</h3>
          {isOwner && (
            <span className="text-xs rounded-full bg-blue-500 text-white px-2 py-0.5 font-medium flex-shrink-0">
              Tu evento
            </span>
          )}
        </div>
        <span className="text-xs rounded-full border px-2 py-0.5 flex-shrink-0 self-start sm:self-auto">{ev.category}</span>
      </div>
      <div className="text-xs text-gray-600 mt-1 break-words">
        {new Date(ev.fecha_inicio).toLocaleString('es-AR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })} → {new Date(ev.fecha_fin).toLocaleString('es-AR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
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
      {ev.description && <p className="text-xs sm:text-sm text-gray-700 mt-2 line-clamp-2">{ev.description}</p>}
    </Link>
  )
}
