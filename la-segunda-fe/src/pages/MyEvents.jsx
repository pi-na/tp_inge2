import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import EventCard from '../components/EventCard.jsx'
import { getUserId } from '../lib/auth.js'

export default function MyEvents() {
  const [events, setEvents] = useState({
    activos_no_finalizados: [],
    activos_finalizados: [],
    eliminados: []
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    const userId = getUserId()
    if (!userId) {
      return
    }
    setLoading(true)
    try {
      const data = await api.get('/events/my')
      setEvents(data)
    } catch (err) {
      console.error('Error cargando eventos:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Cargando…</div>
  }

  const total = events.activos_no_finalizados.length + 
                events.activos_finalizados.length + 
                events.eliminados.length

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Mis Eventos</h1>
        <button 
          className="px-3 sm:px-4 py-2 rounded bg-sky-500 text-white hover:bg-sky-600 text-sm sm:text-base whitespace-nowrap"
          onClick={refresh}
        >
          Actualizar
        </button>
      </div>

      {total === 0 ? (
        <div className="text-gray-600 text-center py-8 text-sm sm:text-base">
          No has creado ningún evento aún.
        </div>
      ) : (
        <>
          {/* Activos y no comenzados/en transcurso */}
          {events.activos_no_finalizados.length > 0 && (
            <div>
              <h2 className="text-base sm:text-lg font-semibold mb-3 text-green-700">
                Activos y no finalizados ({events.activos_no_finalizados.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {events.activos_no_finalizados.map(ev => (
                  <EventCard key={ev.id} ev={ev} isOwner={true} />
                ))}
              </div>
            </div>
          )}

          {/* Activos y finalizados */}
          {events.activos_finalizados.length > 0 && (
            <div>
              <h2 className="text-base sm:text-lg font-semibold mb-3 text-blue-700">
                Activos y finalizados ({events.activos_finalizados.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {events.activos_finalizados.map(ev => (
                  <EventCard key={ev.id} ev={ev} isOwner={true} />
                ))}
              </div>
            </div>
          )}

          {/* Eliminados */}
          {events.eliminados.length > 0 && (
            <div>
              <h2 className="text-base sm:text-lg font-semibold mb-3 text-gray-600">
                Eliminados ({events.eliminados.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {events.eliminados.map(ev => (
                  <EventCard key={ev.id} ev={ev} isOwner={true} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

